import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  createOutput,
  calculateBlockReward,
  createTransaction,
  calculateTransactionHash,
  calculateHashTarget,
  hexToBigInt,
  calculateMerkleRoot,
  calculateBlockHash,
} from "blockcrypto";

import params from "../params";
import {
  nodeDonationPercent,
  nodeDonationAddress,
  poolAddress,
  poolTargetShareTime,
  poolShareDifficultyRecalcFreq,
} from "../config";
import { calculateDifficulty, getHeadBlock } from "../controllers/blockchain.controller";
import { calculateTransactionFees } from "../controllers/transaction.controller";
import { getValidMempool } from "../controllers/mempool.controller";
import { mapVCode, VCODE } from "../helpers/validation-codes";
import { round4, clamp } from "../helpers/general.helper";
import { addBlock } from "../middlewares/block.middleware";
import { PoolMiners, PoolRewards } from "../models";

/**
 * this pool will adopt the PPLNS mechanism
 * https://www.nicehash.com/blog/post/how-mining-pools-distribute-rewards-pps-vs-fpps-vs-pplns
 */
const calculateUnclampedHashTarget = (params, block) => {
  // divide by multiplying divisor by 1000 then dividing results by 1000
  const initHashTarget = hexToBigInt(params.initHashTarg);
  const hashTarget = (initHashTarget / BigInt(Math.trunc(block.difficulty * 1000))) * 1000n;
  return hashTarget;
};

const router = Router();

router.get("/pool/info", (_, res) => {
  res.send({ poolAddress, poolTargetShareTime });
});

router.get(
  "/pool/candidate-block/:address",
  //   rateLimit({
  //     windowMs: 60 * 1000, // 1 minute
  //     max: 2,
  //     standardHeaders: true,
  //     legacyHeaders: false,
  //   }), // must be rate limited to at least target share time
  async (req, res) => {
    const { address: minerAddress } = req.params;

    const previousBlock = await getHeadBlock();
    const difficulty = await calculateDifficulty(previousBlock);
    const mempool = await getValidMempool();

    const selectedTxs = mempool.length ? [mempool[0]] : [];
    const fees = await calculateTransactionFees(selectedTxs);

    const blockReward = calculateBlockReward(params, previousBlock.height + 1) + fees;
    const donationAmount = Math.ceil(blockReward * nodeDonationPercent);
    const coinbaseAmount = blockReward - donationAmount;

    // coinbase transaction
    const coinbaseOutput = createOutput(poolAddress, coinbaseAmount);
    const donationOutput = createOutput(nodeDonationAddress, donationAmount);
    const coinbase = createTransaction(params, [], [coinbaseOutput, donationOutput], `Mined by ${minerAddress}`);
    coinbase.hash = calculateTransactionHash(coinbase);

    const transactions = [coinbase, ...selectedTxs];

    const candidateBlock = {
      height: previousBlock.height + 1,
      previousHash: previousBlock.hash,
      merkleRoot: calculateMerkleRoot(transactions.map(tx => tx.hash)),
      timestamp: Date.now(),
      version: params.version,
      difficulty,
      nonce: 0,
      transactions,
    };

    const poolMiner = await PoolMiners.findOne({ address: minerAddress });
    if (poolMiner) {
      poolMiner.candidateBlock = candidateBlock;
      poolMiner.previousNonce = -1;
      await poolMiner.save();
      return res.status(201).send({ candidateBlock, shareDifficulty: poolMiner.shareDifficulty });
    }

    const shareDifficulty = round4(params.initBlkDiff * (poolTargetShareTime / params.targBlkTime));
    await PoolMiners.create({
      address: minerAddress,
      candidateBlock,
      shareDifficulty,
    });
    return res.status(201).send({ candidateBlock, shareDifficulty });
  }
);

router.post(
  "/pool/block",
  async (req: any, res, next) => {
    const { nonce, hash, miner } = req.body;
    if (!hash) return res.sendStatus(400);
    if (nonce == null) return res.sendStatus(400);
    if (!miner) return res.sendStatus(400);

    const poolMiner = await PoolMiners.findOne({ address: miner });
    if (!poolMiner) return res.status(404).send("Pool miner not found.");

    const { candidateBlock, shareDifficulty, previousNonce, numShareSubmissions, prevShareDiffRecalcTime } =
      poolMiner.toObject();

    // check not reusing nonce, miners MUST increase nonce when mining
    if (nonce <= previousNonce) return res.status(406).send("Reusing nonce.");

    // validate pool block for share
    const block = { ...candidateBlock, hash, nonce };
    if (hash !== calculateBlockHash(block)) return res.status(400).send(mapVCode(VCODE.BK05)); // invalid block hash

    const shareTargetHash = calculateUnclampedHashTarget(params, { difficulty: shareDifficulty });
    const actualHash = hexToBigInt(hash);
    if (actualHash > shareTargetHash) return res.status(400).send(mapVCode(VCODE.BK07, shareTargetHash)); // hash not within share target

    // grant shares based on share difficulty
    const minShareDifficulty = params.initBlkDiff * (poolTargetShareTime / params.targBlkTime);
    const numSharesGranted = Math.trunc(shareDifficulty / block.difficulty / minShareDifficulty);

    // share difficulty recalc
    if (numShareSubmissions % poolShareDifficultyRecalcFreq === 0) {
      console.log("prev share diff:", shareDifficulty);
      const currTime = Date.now();
      const timeDifference = (currTime - prevShareDiffRecalcTime) / 1000; // divide to get seconds
      const targetTimeDifference = poolShareDifficultyRecalcFreq * poolTargetShareTime;
      const correctionFactor = targetTimeDifference / timeDifference;

      const minShareDifficulty = params.initBlkDiff * (poolTargetShareTime / params.targBlkTime);
      console.log("minShareDifficulty", minShareDifficulty);
      console.log("block.difficulty", block.difficulty);
      poolMiner.shareDifficulty = round4(
        clamp(shareDifficulty * correctionFactor, minShareDifficulty, block.difficulty)
      );
      poolMiner.prevShareDiffRecalcTime = currTime;
      console.log("new share diff:", poolMiner.shareDifficulty);
    }

    poolMiner.numShares += numSharesGranted;
    poolMiner.previousNonce = nonce;
    poolMiner.numShareSubmissions++;
    await poolMiner.save();

    // check if it fulfills blockchain PoW
    const targetHash = calculateHashTarget(params, candidateBlock);
    if (actualHash > targetHash)
      return res.status(201).send({ numSharesGranted, totalShares: poolMiner.numShares, isValid: false }); // not good enough for blockchain PoW

    // we got a winning block!
    console.log("adding block to blockchain!");
    req.numSharesGranted = numSharesGranted;
    req.totalShares = poolMiner.numShares;
    req.block = block;
    next();
  },
  addBlock,
  async (req: any, res) => {
    // TODO: make reward distribution transaction
    const poolMiners = await PoolMiners.find({ numShares: { $gt: 0 } }, { _id: false });
    await PoolRewards.create({
      blockHash: req.block.hash,
      blockHeight: req.block.height,
      minerShares: poolMiners,
    });
    await PoolMiners.updateMany({ numShares: { $gt: 0 } }, { $set: { numShares: 0 } });

    res.status(201).send({ numSharesGranted: req.numSharesGranted, totalShares: req.totalShares, isValid: true });
  }
);

export default router;

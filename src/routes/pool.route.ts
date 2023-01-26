import { Router } from "express";
import rateLimit from "express-rate-limit";
import queue from "express-queue";
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
  isProduction,
  canMine,
} from "../config";
import { calculateNextDifficulty, getHeadBlock } from "../controllers/blockchain.controller";
import { calculateTransactionFees } from "../controllers/transaction.controller";
import { getValidMempool } from "../controllers/mempool.controller";
import { mapVCode, VCODE } from "../helpers/validation-codes";
import { round4, clamp } from "../helpers/general.helper";
import { addBlock } from "../middlewares/block.middleware";
import { Transaction } from "../models/types";
import { PoolMiners, PoolRewards } from "../models";
import { isAddressValid } from "blockcrypto";
import { authorizeUser } from "../middlewares/authentication.middleware";

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
  rateLimit({
    windowMs: poolTargetShareTime * 1000,
    max: poolShareDifficultyRecalcFreq,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
  }), // must be rate limited to at least target share time
  async (req, res) => {
    const { address: minerAddress } = req.params;
    if (!isAddressValid(params, minerAddress)) return res.status(400).send("Miner address is invalid.");

    const previousBlock = await getHeadBlock();

    const poolMiner = await PoolMiners.findOne({ address: minerAddress });
    if (
      poolMiner?.candidateBlock.previousHash === previousBlock.hash &&
      poolMiner.previousNonce < Number.MAX_SAFE_INTEGER
    )
      // return same candidate block (since its the same parent), as long as nonce is not too big
      return res.status(200).send({
        candidateBlock: { ...poolMiner.toObject().candidateBlock, nonce: poolMiner.previousNonce + 1 },
        shareDifficulty: poolMiner.shareDifficulty,
      });

    const difficulty = await calculateNextDifficulty(previousBlock);
    const mempool = await getValidMempool();

    const selectedTxs = mempool.length ? [mempool[0]] : [];
    const fees = await calculateTransactionFees(selectedTxs);

    const blockReward = calculateBlockReward(params, previousBlock.height + 1) + fees;
    const donationAmount = Math.ceil(blockReward * nodeDonationPercent);
    const coinbaseAmount = blockReward - donationAmount;

    // coinbase transaction
    const coinbaseOutput = createOutput(poolAddress, coinbaseAmount);
    const donationOutput = createOutput(nodeDonationAddress, donationAmount);
    const coinbase = createTransaction(
      params,
      [],
      [coinbaseOutput, donationOutput],
      `Mined by ${minerAddress}` as any
    ) as any;
    coinbase.hash = calculateTransactionHash(coinbase);

    const transactions: Transaction[] = [coinbase, ...selectedTxs];

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
  canMine ? (req, res, next) => next() : authorizeUser,
  queue({
    activeLimit: 1,
    queuedLimit: 30,
  }),
  rateLimit({
    windowMs: poolTargetShareTime * 1000,
    max: poolShareDifficultyRecalcFreq,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
  }), // must be rate limited to at least target share time
  async (req: any, res, next) => {
    const { nonce, hash, miner } = req.body;
    if (!hash) return res.sendStatus(400);
    if (nonce == null) return res.sendStatus(400);
    if (!miner) return res.sendStatus(400);

    const poolMiner = await PoolMiners.findOne({ address: miner });
    if (!poolMiner) return res.status(404).send("Pool miner not found.");

    const { candidateBlock, shareDifficulty, previousNonce, totalAcceptedShares, prevShareDiffRecalcTime } =
      poolMiner.toObject();

    // check if candidate block is outdated
    const previousBlock = await getHeadBlock();
    if (candidateBlock.previousHash !== previousBlock.hash)
      return res.status(406).send("Candidate block outdated, consider renewing it first.");

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
    const numSharesGranted = Math.trunc(shareDifficulty / minShareDifficulty);

    // share difficulty recalc
    if (totalAcceptedShares % poolShareDifficultyRecalcFreq === 0) {
      const currTime = Date.now();
      const timeDifference = (currTime - prevShareDiffRecalcTime) / 1000; // divide to get seconds
      const targetTimeDifference = poolShareDifficultyRecalcFreq * poolTargetShareTime;
      const correctionFactor = targetTimeDifference / timeDifference;

      const minShareDifficulty = params.initBlkDiff * (poolTargetShareTime / params.targBlkTime);
      poolMiner.shareDifficulty = round4(
        clamp(shareDifficulty * correctionFactor, minShareDifficulty, block.difficulty)
      );
      poolMiner.prevShareDiffRecalcTime = currTime;

      // console.log("prev share diff:", shareDifficulty);
      // console.log("minShareDifficulty", minShareDifficulty);
      // console.log("block.difficulty", block.difficulty);
      // console.log("new share diff:", poolMiner.shareDifficulty);
    }

    poolMiner.numShares += numSharesGranted;
    poolMiner.previousNonce = nonce;
    poolMiner.totalAcceptedShares++;
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

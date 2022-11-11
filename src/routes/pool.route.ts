import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  createOutput,
  createInput,
  calculateBlockReward,
  createTransaction,
  calculateTransactionHash,
  calculateHashTarget,
  bigIntToHex64,
  hexToBigInt,
  calculateMerkleRoot,
  calculateBlockHash,
} from "blockcrypto";

import params from "../params";
import {
  nodeDonationPercent,
  nodeDonationAddress,
  poolDifficultyPercent,
  poolMinDifficulty,
  poolAddress,
  poolOperatorFeePercent,
} from "../config";
import { calculateDifficulty, getHeadBlock } from "../controllers/blockchain.controller";
import { calculateTransactionFees } from "../controllers/transaction.controller";
import { getValidMempool } from "../controllers/mempool.controller";
import { mapVCode, VCODE } from "../helpers/validation-codes";

/**
 * this pool will adopt the PPLNS mechanism
 * https://www.nicehash.com/blog/post/how-mining-pools-distribute-rewards-pps-vs-fpps-vs-pplns
 */

const router = Router();

const calculatePoolInfo = async () => {
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
  const coinbase = createTransaction(params, [], [coinbaseOutput, donationOutput]);
  coinbase.hash = calculateTransactionHash(coinbase);

  // reward distribution transaction (no fees required)

  const poolTransactions = [coinbase, ...selectedTxs];

  const poolCandidateBlockHeader = {
    height: previousBlock.height + 1,
    previousHash: previousBlock.hash,
    merkleRoot: calculateMerkleRoot(poolTransactions.map(tx => tx.hash)),
    timestamp: Date.now(),
    version: params.version,
    difficulty,
    nonce: 0,
    hash: "",
  };

  const poolDifficulty = Math.max(difficulty * poolDifficultyPercent, poolMinDifficulty);
  return { poolCandidateBlockHeader, poolTransactions, poolDifficulty };
};

router.get("/pool/init", async (req, res) => {
  const { poolCandidateBlockHeader, poolTransactions, poolDifficulty } = await calculatePoolInfo();
  req.app.locals.poolCandidateBlockHeader = poolCandidateBlockHeader;
  req.app.locals.poolTransactions = poolTransactions;
  req.app.locals.poolDifficulty = poolDifficulty;
  req.app.locals.minerShares = new Map();

  res.send({ poolCandidateBlockHeader, poolTransactions, poolDifficulty });
});

router.get(
  "/pool/candidate-block",
  //   rateLimit({
  //     windowMs: 60 * 1000, // 1 minute
  //     max: 2,
  //     standardHeaders: true,
  //     legacyHeaders: false,
  //   }),
  async (req, res) => {
    const { poolCandidateBlockHeader } = req.app.locals;
    if (!poolCandidateBlockHeader)
      return res.status(500).send("Pool candidate block not generated.");

    const poolDifficulty = req.app.locals.poolDifficulty;
    res.send({ poolCandidateBlockHeader, poolDifficulty });
  }
);

router.post("/pool/block", async (req, res) => {
  const { nonce, hash, miner } = req.body;
  if (!hash) return res.sendStatus(400);
  if (nonce == null) return res.sendStatus(400);

  const { poolCandidateBlockHeader, poolDifficulty } = req.app.locals;
  if (!poolCandidateBlockHeader) return res.status(500).send("Pool candidate block not generated.");

  console.log(poolCandidateBlockHeader);

  // validate pool block for share
  const poolBlock = { ...poolCandidateBlockHeader, hash, nonce };
  if (hash !== calculateBlockHash(poolBlock)) return res.status(400).send(mapVCode(VCODE.BK05)); // invalid block hash

  const poolHashTarget = calculateHashTarget(params, { difficulty: poolDifficulty });
  const hashBigInt = hexToBigInt(hash);
  if (hashBigInt > poolHashTarget)
    return res.status(400).send(mapVCode(VCODE.BK07, poolHashTarget)); // hash not within pool target

  // grant shares based on difficulty of hash
  const sharesGranted = 1;
  if (miner) {
    const numShares = req.app.locals.minerShares.get(miner);

    // TODO: validate address?
    req.app.locals.minerShares.set(miner, numShares ? numShares + sharesGranted : sharesGranted);
  }

  // check if it fulfills blockchain PoW
  const hashTarget = calculateHashTarget(params, poolCandidateBlockHeader);
  if (hashBigInt > hashTarget)
    return res.status(201).send({ validation: mapVCode(VCODE.VALID), sharesGranted }); // not good enough for blockchain PoW

  // we got a winning block!
  console.log("adding block to blockchain!");

  res.status(201).send({ validation: mapVCode(VCODE.VALID), sharesGranted });
});

export default router;

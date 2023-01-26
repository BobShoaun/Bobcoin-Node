import { Router } from "express";
import rateLimit from "express-rate-limit";
import { BlocksInfo, Utxos, Blocks } from "../models";
import params from "../params";
import {
  createOutput,
  calculateBlockReward,
  createTransaction,
  calculateTransactionHash,
  calculateMerkleRoot,
  createBlock,
} from "blockcrypto";
import { getValidMempool } from "../controllers/mempool.controller";
import { calculateNextDifficulty, getHeadBlock } from "../controllers/blockchain.controller";
import { validateCandidateBlock } from "../controllers/validation.controller";
import { Block, Transaction } from "../models/types";
import { mapVCode, VCODE } from "../helpers/validation-codes";
import { calculateTransactionFees } from "../controllers/transaction.controller";
import { nodeDonationPercent, nodeDonationAddress, isProduction } from "../config";

const router = Router();

router.get("/mine/info", async (req, res) => {
  const headBlock = await getHeadBlock();
  const numClients = req.app.locals.io.engine.clientsCount;
  const difficulty = await calculateNextDifficulty(headBlock);

  res.send({ numClients, difficulty });
});

router.post(
  "/mine/candidate-block",
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 2,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
  }),
  async (req, res) => {
    const { previousBlockHash, miner } = req.body;
    const _transactions = req.body.transactions ?? [];
    if (!miner) return res.sendStatus(400);

    const previousBlock = previousBlockHash
      ? await Blocks.findOne({ hash: previousBlockHash }, "-_id hash height").lean()
      : await getHeadBlock();

    if (!previousBlock) return res.status(404).send("Previous block not found.");

    const fees = await calculateTransactionFees(_transactions);
    const blockReward = calculateBlockReward(params, previousBlock.height + 1) + fees;
    const donationAmount = Math.ceil(blockReward * nodeDonationPercent);
    const coinbaseAmount = blockReward - donationAmount;

    // coinbase transaction
    const coinbaseOutput = createOutput(miner, coinbaseAmount);
    const donationOutput = createOutput(nodeDonationAddress, donationAmount);
    const coinbase = createTransaction(params, [], [coinbaseOutput, donationOutput]);
    coinbase.hash = calculateTransactionHash(coinbase);

    const transactions = [coinbase, ..._transactions];
    const difficulty = await calculateNextDifficulty(previousBlock);
    const candidateBlock = createBlock(params, previousBlock, difficulty, transactions);

    const validation = await validateCandidateBlock(candidateBlock);
    // const validation = mapVCode(VCODE.VALID); // FIXME: temporary disable candidate block validation
    res.send({ validation, candidateBlock });
  }
);

export default router;

import { Router } from "express";
import { BlocksInfo, Utxos } from "../models";
import params from "../params";
import {
  createOutput,
  calculateBlockReward,
  createTransaction,
  calculateTransactionHash,
  calculateHashTarget,
  bigIntToHex64,
  calculateMerkleRoot,
} from "blockcrypto";
import { getValidMempool } from "../controllers/mempool.controller";
import { calculateDifficulty, getHeadBlock } from "../controllers/blockchain.controller";
import { validateCandidateBlock } from "../controllers/validation.controller";
import { Block, Transaction } from "../models/types";

const router = Router();

router.get("/mine/info", async (req, res) => {
  const headBlock = await getHeadBlock();
  const numClients = req.app.locals.io.engine.clientsCount;
  const difficulty = await calculateDifficulty(headBlock);

  res.send({ numClients, difficulty });
});

router.post("/mine/candidate-block", async (req, res) => {
  const { previousBlockHash, miner } = req.body;
  const transactions = req.body.transactions ?? [];
  if (!miner) return res.sendStatus(400);

  const previousBlock = previousBlockHash
    ? await BlocksInfo.findOne({ hash: previousBlockHash }, { _id: 0 })
    : (await BlocksInfo.find({ valid: true }, { _id: 0 }).sort({ height: -1 }).limit(1))[0];

  if (!previousBlock) return res.status(404).send("Previous block not found.");

  let totalInput = 0;
  let totalOutput = 0;

  const newUtxos = [];
  for (const transaction of transactions) {
    for (const input of transaction.inputs) {
      let utxo = newUtxos.find(
        utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
      );
      if (!utxo)
        // not in new utxos list
        utxo = await Utxos.findOne(
          { txHash: input.txHash, outIndex: input.outIndex },
          { _id: 0 }
        ).lean();
      totalInput += utxo?.amount ?? 0; // utxo may be null, in that case it should fail when validating
    }

    for (let i = 0; i < transaction.outputs.length; i++) {
      const output = transaction.outputs[i];
      totalOutput += output.amount;
      newUtxos.push({
        txHash: transaction.hash,
        outIndex: i,
        address: output.address,
        amount: output.amount,
      });
    }
  }

  const fees = Math.max(totalInput - totalOutput, 0);
  const output = createOutput(miner, calculateBlockReward(params, previousBlock.height + 1) + fees);
  const coinbase = createTransaction(params, [], [output]);
  coinbase.hash = calculateTransactionHash(coinbase);

  const block = await createBlock(params, previousBlock, [coinbase, ...transactions]);
  const target = bigIntToHex64(calculateHashTarget(params, block));

  const validation = await validateCandidateBlock(block);
  res.send({ validation, block, target });
});

const createBlock = async (params, previousBlock: Block, transactions: Transaction[]) => ({
  height: previousBlock.height + 1,
  previousHash: previousBlock.hash,
  transactions,
  timestamp: Date.now(),
  version: params.version,
  difficulty: await calculateDifficulty(previousBlock),
  merkleRoot: calculateMerkleRoot(transactions.map(tx => tx.hash)),
  nonce: 0,
  hash: "",
});

export default router;

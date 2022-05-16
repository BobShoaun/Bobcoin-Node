// @ts-nocheck
import { Router } from "express";
import { BlocksInfo, Mempool, Utxos } from "../models";

const router = Router();

router.get("/transactions", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const offset = parseInt(req.query.offset);
  const txBlocks = await BlocksInfo.find().limit(10);
  const txs = txBlocks.reduce((txs, block) => [...txs, ...block.transactions], []);
  res.send(txs);
});

router.get("/transaction/:hash", async (req, res) => {
  const { hash } = req.params;

  const txBlock = await BlocksInfo.findOne(
    { "transactions.hash": hash },
    { height: 1, valid: 1, hash: 1, "transactions.$": 1 }
  ).lean();
  if (!txBlock) return res.sendStatus(404);

  //   let status = "invalid";
  // if (txBlock.valid) status = "confirmed"

  const transaction = txBlock.transactions[0];
  res.send({ ...transaction, blockHeight: txBlock.height, blockHash: txBlock.hash });
});

router.get("/mempool", async (req, res) => {
  const transactions = await Mempool.find({}, { _id: false }).lean();

  const validMempool = [];
  for (const transaction of transactions) {
    let valid = true;
    for (const input of transaction.inputs) {
      const utxo = await Utxos.findOne({ txHash: input.txHash, outIndex: input.outIndex }); // TODO: check from mempool utxo set
      if (!utxo) {
        valid = false;
        break;
      }
      input.address = utxo.address;
      input.amount = utxo.amount;
    }
    if (valid) validMempool.push(transaction);
    else console.log(`txId: ${transaction.hash} is no longer valid.`);
  }

  res.send(validMempool);
});

export default router;

// @ts-nocheck
import { Router } from "express";
import { BlocksInfo } from "../models";

const router = Router();

router.get("/address/info/:address", async (req, res) => {
  const { address } = req.params;
  const utxos = req.app.locals.utxos.filter(utxo => utxo.address === address);
  const numUtxos = utxos.length;
  const balance = utxos.reduce((total, utxo) => total + utxo.amount, 0);

  const txBlocks = await BlocksInfo.find(
    {
      $or: [
        { "transactions.inputs.address": address },
        { "transactions.outputs.address": address },
      ],
      valid: true,
    },
    { _id: false }
  );

  let totalSent = 0;
  let totalReceived = 0;
  let numTransactions = 0;
  let numBlocksMined = 0;

  for (const block of txBlocks) {
    for (const transaction of block.transactions) {
      let txCounts = false;
      for (const input of transaction.inputs) {
        if (input.address !== address) continue;
        totalSent += input.amount;
        txCounts = true;
      }
      for (const output of transaction.outputs) {
        if (output.address !== address) continue;
        totalReceived += output.amount;
        txCounts = true;
      }
      if (!txCounts) continue;
      numTransactions++;
      if (transaction.inputs.length === 0) numBlocksMined++;
    }
  }

  const diff = totalReceived - totalSent;

  res.send({ balance, totalReceived, totalSent, numUtxos, numTransactions, numBlocksMined, diff });
});

export default router;

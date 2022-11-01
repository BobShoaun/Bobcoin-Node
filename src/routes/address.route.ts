import { Router } from "express";
import { BlocksInfo, Utxos } from "../models";

const router = Router();

router.get("/address/:address/info", async (req, res) => {
  const { address } = req.params;
  const utxos = await Utxos.find({ address });
  const numUtxos = utxos.length;
  const balance = utxos.reduce((total, utxo) => total + utxo.amount, 0);

  const transactions = await BlocksInfo.aggregate([
    { $match: { valid: true } },
    { $unwind: "$transactions" },
    { $project: { _id: 0, transactions: 1 } },
    { $replaceRoot: { newRoot: { $mergeObjects: ["$transactions", "$$ROOT"] } } },
    { $project: { transactions: 0 } },
    { $match: { $or: [{ "inputs.address": address }, { "outputs.address": address }] } },
  ]);

  const numTransactions = transactions.length;
  let totalSent = 0;
  let totalReceived = 0;
  let numBlocksMined = 0;

  for (const transaction of transactions) {
    if (!transaction.inputs.length) numBlocksMined++;

    const inputAmount = transaction.inputs
      .filter(input => input.address === address)
      .reduce((sum, input) => sum + input.amount, 0);
    const outputAmount = transaction.outputs
      .filter(output => output.address === address)
      .reduce((sum, output) => sum + output.amount, 0);

    const difference = Math.abs(inputAmount - outputAmount);

    if (inputAmount > outputAmount) totalSent += difference;
    else totalReceived += difference;
  }

  res.send({ balance, totalReceived, totalSent, numUtxos, numTransactions, numBlocksMined });
});

router.get("/address/:address/transactions", async (req, res) => {
  const { address } = req.params;
  const offset = parseInt(req.query.offset as string);
  const limit = parseInt(req.query.limit as string);

  const transactions = await BlocksInfo.aggregate([
    { $unwind: "$transactions" },
    {
      $project: {
        _id: 0,
        block: {
          height: "$height",
          hash: "$hash",
          valid: "$valid",
        },
        transactions: 1,
      },
    },
    { $replaceRoot: { newRoot: { $mergeObjects: ["$transactions", "$$ROOT"] } } },
    { $project: { transactions: 0 } },
    {
      $match: {
        $or: [{ "inputs.address": address }, { "outputs.address": address }],
        "block.valid": true,
      },
    },
    { $sort: { timestamp: -1 } },
    { $skip: offset > 0 ? offset : 0 },
    { $limit: limit > 0 ? limit : Number.MAX_SAFE_INTEGER },
  ]);

  res.send(transactions);
});

export default router;

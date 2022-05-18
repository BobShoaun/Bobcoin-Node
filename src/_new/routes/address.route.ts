// @ts-nocheck
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
    if (transaction.inputs.length === 0) numBlocksMined++;
    for (const input of transaction.inputs) {
      if (input.address !== address) continue;
      totalSent += input.amount;
    }
    for (const output of transaction.outputs) {
      if (output.address !== address) continue;
      totalReceived += output.amount;
    }
  }

  res.send({ balance, totalReceived, totalSent, numUtxos, numTransactions, numBlocksMined });
});

router.get("/address/:address/transactions", async (req, res) => {
  const { address } = req.params;
  const offset = parseInt(req.query.offset);
  const limit = parseInt(req.query.limit);

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
    { $skip: offset > 0 ? offset : 0 },
    { $limit: limit > 0 ? limit : Number.MAX_SAFE_INTEGER },
  ]);

  res.send(transactions);
});

// multiple addresses - Wallet
router.post("/address/info", async (req, res) => {
  const addresses = req.body;
  if (!addresses) return res.sendStatus(404);

  const utxos = await Utxos.find({ address: { $in: addresses } });
  const numUtxos = utxos.length;
  const balance = utxos.reduce((total, utxo) => total + utxo.amount, 0);

  const transactions = await BlocksInfo.aggregate([
    { $match: { valid: true } },
    { $unwind: "$transactions" },
    { $project: { _id: 0, transactions: 1 } },
    { $replaceRoot: { newRoot: { $mergeObjects: ["$transactions", "$$ROOT"] } } },
    { $project: { transactions: 0 } },
    {
      $match: {
        $or: [{ "inputs.address": { $in: addresses } }, { "outputs.address": { $in: addresses } }],
      },
    },
  ]);

  const numTransactions = transactions.length;
  let totalSent = 0;
  let totalReceived = 0;
  let numBlocksMined = 0;

  for (const transaction of transactions) {
    if (transaction.inputs.length === 0) numBlocksMined++;
    for (const input of transaction.inputs)
      if (addresses.includes(input.address)) totalSent += input.amount;
    for (const output of transaction.outputs)
      if (addresses.includes(output.address)) totalReceived += output.amount;
  }

  res.send({ balance, totalReceived, totalSent, numUtxos, numTransactions, numBlocksMined });
});

// multiple addresses - Wallet
router.post("/address/transactions", async (req, res) => {
  const addresses = req.body;
  if (!addresses) return res.sendStatus(404);
  const offset = parseInt(req.query.offset);
  const limit = parseInt(req.query.limit);

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
        $or: [{ "inputs.address": { $in: addresses } }, { "outputs.address": { $in: addresses } }],
        "block.valid": true,
      },
    },
    { $skip: offset > 0 ? offset : 0 },
    { $limit: limit > 0 ? limit : Number.MAX_SAFE_INTEGER },
  ]);

  res.send(transactions);
});

export default router;

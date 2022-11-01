import { Router } from "express";
import { BlocksInfo, Utxos } from "../models";
import { getBlockchainUtxosForAddresses } from "../controllers/utxo.controller";
import { getValidMempoolForAddresses } from "../controllers/mempool.controller";

const router = Router();

router.post("/wallet/info", async (req, res) => {
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
    if (!transaction.inputs.length) numBlocksMined++;

    const inputAmount = transaction.inputs
      .filter(input => addresses.includes(input.address))
      .reduce((sum, input) => sum + input.amount, 0);
    const outputAmount = transaction.outputs
      .filter(output => addresses.includes(output.address))
      .reduce((sum, output) => sum + output.amount, 0);

    const difference = Math.abs(inputAmount - outputAmount);

    if (inputAmount > outputAmount) totalSent += difference;
    else totalReceived += difference;
  }

  res.send({ balance, totalReceived, totalSent, numUtxos, numTransactions, numBlocksMined });
});

router.post("/wallet/transactions", async (req, res) => {
  const addresses = req.body;
  if (!addresses) return res.sendStatus(404);
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
        $or: [{ "inputs.address": { $in: addresses } }, { "outputs.address": { $in: addresses } }],
        "block.valid": true,
      },
    },
    { $sort: { timestamp: -1 } },
    { $skip: offset > 0 ? offset : 0 },
    { $limit: limit > 0 ? limit : Number.MAX_SAFE_INTEGER },
  ]);

  res.send(transactions);
});

// check if address are used (mentioned in blockchain) for address discovery
router.post("/wallet/used", async (req, res) => {
  const addresses = req.body;
  if (!addresses) return res.sendStatus(404);

  const results = [];
  for (const address of addresses) {
    const used = await BlocksInfo.exists({
      $or: [
        { "transactions.inputs.address": address },
        { "transactions.outputs.address": address },
      ],
    });
    results.push({ address, used });
  }

  res.send(results);
});

router.post("/wallet/utxos", async (req, res) => {
  const addresses = req.body;
  if (!addresses) return res.sendStatus(404);

  const utxos = await getBlockchainUtxosForAddresses(addresses);
  res.send(utxos);
});

router.post("/wallet/mempool", async (req, res) => {
  const addresses = req.body;
  if (!addresses) return res.sendStatus(404);
  const offset = parseInt(req.query.offset as string);
  const limit = parseInt(req.query.limit as string);
  const mempool = await getValidMempoolForAddresses(addresses);
  res.send(mempool);
});

export default router;

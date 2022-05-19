// @ts-nocheck
import { Router } from "express";
import { BlocksInfo, Mempool, Utxos } from "../models";

const router = Router();

router.get("/transactions", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const offset = parseInt(req.query.offset);

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
    { $skip: offset > 0 ? offset : 0 },
    { $limit: limit > 0 ? limit : Number.MAX_SAFE_INTEGER },
  ]);
  res.send(transactions);
});

router.get("/transaction/:hash", async (req, res) => {
  const { hash } = req.params;
  const { block } = req.query;

  const transactions = await BlocksInfo.aggregate([
    { $match: block ? { hash: block } : {} },
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
    { $match: { hash } },
  ]);

  if (!transactions.length) return res.sendStatus(404);

  const transaction = transactions[0];
  res.send(transaction);
});

// confirmed transactions in a block
router.get("/transactions/count", async (req, res) => {
  const transactions = await BlocksInfo.aggregate([
    { $match: { valid: true } },
    { $unwind: "$transactions" },
    { $count: "count" },
  ]);
  res.send(transactions[0]);
});

router.post("/transaction", async (req, res) => {
  const transaction = req.body;
  res.status(201).send(transaction);
});

export default router;

import { Router } from "express";
import { BlocksInfo, Mempool, Utxos } from "../models";
import { addTransaction } from "../controllers/transaction.controller";
import { TransactionInfo } from "../models/types";
import { getValidMempool } from "../controllers/mempool.controller";

const router = Router();

router.get("/transactions", async (req, res) => {
  const limit = parseInt(req.query.limit as string);
  const offset = parseInt(req.query.offset as string);

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
    { $sort: { timestamp: -1 } },
    { $skip: offset > 0 ? offset : 0 },
    { $limit: limit > 0 ? limit : Number.MAX_SAFE_INTEGER },
  ]);
  res.send(transactions);
});

router.get("/transaction/:hash", async (req, res) => {
  const { hash } = req.params;
  const { block } = req.query;

  // check blocks first
  const transactions = await BlocksInfo.aggregate([
    { $match: block ? { hash: block } : { valid: true } },
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
  if (transactions.length) return res.send(transactions[0]);

  // check mempool
  const transaction = (await Mempool.findOne({ hash }, { _id: 0 }).lean()) as TransactionInfo;

  if (transaction) {
    for (const input of transaction.inputs) {
      const utxo = await Utxos.findOne({ txHash: input.txHash, outIndex: input.outIndex }); // TODO: check from mempool utxo set
      if (!utxo) return res.status(500).send("Mempool tx invalid");
      input.address = utxo.address;
      input.amount = utxo.amount;
    }
    return res.send(transaction);
  }

  return res.sendStatus(404);
});

// confirmed transactions in a block
router.get("/transactions/count", async (req, res) => {
  const transactions = await BlocksInfo.aggregate([
    { $unwind: "$transactions" },
    { $count: "count" },
  ]);
  res.send(transactions[0]);
});

router.post("/transaction", async (req, res) => {
  const transaction = req.body;
  if (!transaction) return res.sendStatus(400);

  try {
    const validation = await addTransaction(transaction);

    req.app.locals.io.emit("transaction", {
      mempool: await getValidMempool(),
    });

    //TODO: inform other nodes of new transaction
    res.status(201).send(validation);
  } catch (e) {
    return res.status(400).send(e);
  }
});

export default router;

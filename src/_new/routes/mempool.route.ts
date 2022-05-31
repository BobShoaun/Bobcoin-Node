// @ts-nocheck
import { Router } from "express";
import { BlocksInfo, Mempool, Utxos } from "../models";

const router = Router();

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

router.get("/mempool/all", async (req, res) => {
  const offset = parseInt(req.query.offset);
  const limit = parseInt(req.query.limit);

  const transactions = await Mempool.find({}, { _id: 0 })
    .sort({ timestamp: -1 })
    .skip(offset ? offset : 0)
    .limit(limit ? limit : 0);
  res.send(transactions);
});

// TODO: remove invalid txs in mempool??
router.get("/mempool/count", async (req, res) => {
  const mempoolCount = await Mempool.countDocuments();
  res.send({ count: mempoolCount });
});

router.get("/mempool/address/:address", async (req, res) => {
  const { address } = req.params;
  const offset = parseInt(req.query.offset);
  const limit = parseInt(req.query.limit);

  const transactions = await Mempool.find(
    { $or: [{ "inputs.address": address }, { "outputs.address": address }] },
    { _id: 0 }
  )
    .sort({ timestamp: -1 })
    .skip(offset ? offset : 0)
    .limit(limit ? limit : 0);
  res.send(transactions);
});

// router.post("/mempool/address", async (req, res) => {
//   const addresses = req.body;
//   if (!addresses) return res.sendStatus(404);
//   const offset = parseInt(req.query.offset);
//   const limit = parseInt(req.query.limit);

//   const transactions = await Mempool.find(
//     { $or: [{ "inputs.address": { $in: addresses } }, { "outputs.address": { $in: addresses } }] },
//     { _id: 0 }
//   )
//     .sort({ timestamp: -1 })
//     .skip(offset ? offset : 0)
//     .limit(limit ? limit : 0);
//   res.send(transactions);
// });

export default router;

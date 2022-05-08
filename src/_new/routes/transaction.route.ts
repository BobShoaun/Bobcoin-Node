// @ts-nocheck
import { Router } from "express";
import { Block } from "../models";

const router = Router();

router.get("/transaction/:hash", async (req, res) => {
  const { hash } = req.params;

  const txBlock = await Block.findOne(
    { "transactions.hash": hash },
    { height: 1, valid: 1, hash: 1, "transactions.$": 1 }
  ).lean();
  if (!txBlock) return res.sendStatus(404);

  //   let status = "invalid";
  // if (txBlock.valid) status = "confirmed"

  const transaction = txBlock.transactions[0];
  res.send({ ...transaction, blockHeight: txBlock.height, blockHash: txBlock.hash });
});

export default router;

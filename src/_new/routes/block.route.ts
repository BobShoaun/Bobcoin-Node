// @ts-nocheck
import { Router } from "express";
import { BlocksInfo } from "../models";
import { RESULT } from "blockcrypto";
// const { RESULT } = BlockCrypto;

const router = Router();

router.get("/blocks", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const height = parseInt(req.query.height);

  const maxHeight = isNaN(height) ? Number.POSITIVE_INFINITY : height;
  const minHeight = isNaN(limit) || isNaN(height) ? Number.NEGATIVE_INFINITY : height - limit; // exclusive

  const blocks = await BlocksInfo.find(
    { height: { $lte: maxHeight, $gt: minHeight } },
    { _id: false }
  ).sort({ height: -1 });
  res.send(blocks);
});

router.get("/block/head", async (req, res) => {
  const headBlock = req.app.locals.headBlock;
  res.send(headBlock);
});

router.post("/block", async (req, res) => {
  const block = req.body.block;
  if (!block) return res.sendStatus(400);

  // validate block
  const isValid = true;
  if (!isValid) return res.status(400).send("Block is invalid");

  const headBlock = req.app.locals.headBlock;

  // common case
  if (block.previousHash === headBlock.hash) {
    block.valid = true;
  }

  res.send("psote");
});

export default router;

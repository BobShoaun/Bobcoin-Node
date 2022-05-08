// @ts-nocheck

import { Router } from "express";
import { Block } from "../models";

const router = Router();

router.get("/blocks", async (req, res) => {
  const blocks = await Block.find();
  res.send(blocks);
});

router.get("/blocks/head", async (req, res) => {
  const highestBlock = await Block.findOne().sort({ height: -1 });
  const blocks = await Block.find({ height: highestBlock.height });
  res.send(blocks);
});

export default router;

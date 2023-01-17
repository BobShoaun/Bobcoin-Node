import { Router, Request } from "express";

import { Blocks, BlocksInfo, Utxos, Mempool } from "../models";
import { validateBlock } from "../controllers/validation.controller";
import { VCODE } from "../helpers/validation-codes";
import { getValidMempool } from "../controllers/mempool.controller";
import { Block, BlockInfo } from "../models/types";
import { getHeadBlock } from "../controllers/blockchain.controller";
import { distributeConfirmedPoolRewards } from "../controllers/pool.controller";
import { addBlock } from "../middlewares/block.middleware";
import { authorizeUser } from "../middlewares/authentication.middleware";

const router = Router();

router.get("/blocks", async (req, res) => {
  const limit = parseInt(req.query.limit as string);
  const height = parseInt(req.query.height as string);

  const maxHeight = isNaN(height) ? Number.POSITIVE_INFINITY : height;
  const minHeight = isNaN(limit) || isNaN(height) ? Number.NEGATIVE_INFINITY : height - limit; // exclusive

  const blocks = await BlocksInfo.find({ height: { $lte: maxHeight, $gt: minHeight } }, { _id: false }).sort({
    height: -1,
  });
  res.send(blocks);
});

router.get("/blocks/raw", async (req, res) => {
  const limit = parseInt(req.query.limit as string);
  const height = parseInt(req.query.height as string);

  const maxHeight = isNaN(height) ? Number.POSITIVE_INFINITY : height;
  const minHeight = isNaN(limit) || isNaN(height) ? Number.NEGATIVE_INFINITY : height - limit; // exclusive

  const blocks = await Blocks.find({ height: { $lte: maxHeight, $gt: minHeight } }, { _id: false }).sort({
    height: -1,
  });
  res.send(blocks);
});

router.get("/block/head", async (req, res) => {
  const headBlock = await getHeadBlock();
  res.send(headBlock);
});

router.get("/blocks/height/:height", async (req: Request<{ height: number }>, res) => {
  const { height } = req.params;
  const blocks = await BlocksInfo.find({ height }, { _id: false }).sort({ valid: -1 }); // show valid ones first
  if (!blocks.length) return res.status(404).send(blocks);
  res.send(blocks);
});

const getBlockHeights = async (height: number, limit: number) =>
  await BlocksInfo.aggregate([
    { $group: { _id: "$height", blocks: { $push: "$$ROOT" } } },
    { $sort: { _id: -1 } },
    { $project: { _id: 0, blocks: 1, height: "$_id" } },
    { $match: { height: { $lte: height } } },
    { $limit: limit },
  ]);

router.get("/blocks/heights", async (req, res) => {
  const height = parseInt(req.query.height as string);
  const limit = parseInt(req.query.limit as string);
  const blockHeights = await getBlockHeights(height, limit);
  res.send(blockHeights);
});

router.get("/block/:hash", async (req, res) => {
  const { hash } = req.params;
  const block = await BlocksInfo.findOne({ hash }, { _id: false });
  if (!block) return res.sendStatus(404);
  res.send(block);
});

router.get("/block/:hash/raw", async (req, res) => {
  const { hash } = req.params;
  const block = await Blocks.findOne({ hash }, { _id: false });
  if (!block) return res.sendStatus(404);
  res.send(block);
});

router.post(
  "/block",
  authorizeUser,
  (req: any, _, next) => ((req.block = req.body), next()),
  addBlock,
  (req: any, res) => res.status(201).send({ validation: req.validation, blockInfo: req.blockInfo })
);

export default router;

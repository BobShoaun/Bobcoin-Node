// @ts-nocheck
import { Router } from "express";
import { BlocksInfo } from "../models";

const router = Router();

router.get("/mine/info", async (req, res) => {
  const headBlock = req.app.locals.headBlock;
  const mempool = [];
  res.send({ headBlock, mempool });
});

router.post("/mine/candidate-block", async (req, res) => {
  const { previousBlock, miner } = req.body;
  const transactions = req.body.transactions ?? [];
  if (!previousBlock || !miner) return res.sendStatus(400);

  // TODO: create candidate block

  res.send();
});

export default router;

import Express from "express";

import { createCandidateBlock, getMiningInfo } from "../controllers/mine.controller";

export const mineRouter = () => {
  const router = Express.Router();

  const error = (res, e) => {
    res.status(400).json(`${e}`);
    console.log(e);
  };

  router.get("/info", (req, res) => {
    res.send(getMiningInfo(req.app.locals));
  });

  router.post("/candidate-block", async (req, res) => {
    const { previousBlock, miner } = req.body;
    const transactions = req.body.transactions ?? [];

    if (!previousBlock || !miner) return res.sendStatus(400);

    try {
      res.send(await createCandidateBlock(req.app.locals, previousBlock, transactions, miner));
    } catch (e) {
      error(res, e);
    }
  });

  return router;
};

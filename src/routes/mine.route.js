import Express from "express";

import {
  createCandidateBlock,
  getMiningInfo,
} from "../controllers/mine.controller.js";

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
    const previousBlock = req.body.previousBlock;
    const transactions = req.body.transactions ?? [];
    const miner = req.body.miner;
    try {
      res.send(
        await createCandidateBlock(
          req.app.locals,
          previousBlock,
          transactions,
          miner
        )
      );
    } catch (e) {
      error(res, e);
    }
  });

  return router;
};

import Express from "express";
import {
  getTransaction,
  addTransaction,
  getTransactionInfo,
  getMempoolInfo,
  getTransactions,
  getTransactionCount,
} from "../controllers/transaction.controller.js";

export const transactionRouter = io => {
  const router = Express.Router();

  function error(res, e) {
    res.status(400).json(`${e}`);
    console.error(e);
  }

  router.get("/", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit);
      const offset = parseInt(req.query.offset);
      const transactions = await getTransactions(limit, offset);
      res.send(transactions);
    } catch (e) {
      error(res, e);
    }
  });

  router.get("/count", async (req, res) => {
    try {
      const count = await getTransactionCount();
      res.send({ count });
    } catch (e) {
      error(res, e);
    }
  });

  router.get("/:hash", async (req, res) => {
    try {
      const transaction = await getTransaction(req.app.locals, req.params.hash);
      res.send(transaction);
    } catch (e) {
      error(res, e);
    }
  });

  router.get("/info/:hash", async (req, res) => {
    try {
      const info = await getTransactionInfo(req.app.locals, req.params.hash, req.query.block);
      res.send(info);
    } catch (e) {
      error(res, e);
    }
  });

  router.get("/mempool", (req, res) => {
    try {
      res.send(req.app.locals.mempool);
    } catch (e) {
      error(res, e);
    }
  });

  router.get("/mempool/info", (req, res) => {
    try {
      res.send(getMempoolInfo(req.app.locals));
    } catch (e) {
      error(res, e);
    }
  });

  router.post("/", (req, res) => {
    try {
      const transaction = req.body.transaction;
      const validation = addTransaction(req.app.locals, transaction, io);
      res.send(validation);
    } catch (e) {
      error(res, e);
    }
  });

  return router;
};

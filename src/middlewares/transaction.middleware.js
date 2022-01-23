import { MempoolTransaction } from "../models/index.js";
import { validatedTransaction } from "../controllers/blockcrypto.js";
import { getMempoolInfo } from "../controllers/transaction.controller.js";
import BlockCrypto from "blockcrypto";
const { RESULT } = BlockCrypto;

export const addTransaction = async (req, res, next) => {
  const transaction = req.transaction;
  const locals = req.app.locals;

  req.validation = validatedTransaction(locals, transaction);
  if (req.validation.code !== RESULT.VALID) return next();

  const socket = locals.socket;

  await MempoolTransaction.create(transaction);
  locals.mempool.push(transaction);

  // broadcast transaction to other nodes and all clients.
  socket.emit("mempool", {
    mempool: getMempoolInfo(locals),
  });

  next();
};

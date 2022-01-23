import {
  OrphanedBlock,
  MatureBlock,
  MempoolTransaction,
  TransactionInfo,
} from "../models/index.js";

import { validatedTransaction } from "./blockcrypto.js";
import { getMempoolUtxos } from "../helpers/utxo.helper.js";

import BlockCrypto from "blockcrypto";
const { RESULT } = BlockCrypto;

export const getTransaction = async (locals, hash) => {
  let transaction = locals.mempool.find(tx => tx.hash === hash);
  if (transaction) return transaction;

  for (const block of locals.unconfirmedBlocks) {
    const tx = block.transactions.find(tx => tx.hash === hash);
    if (tx) {
      transaction = tx;
      break;
    }
  }
  if (transaction) return transaction;

  transaction = (await MatureBlock.findOne({ "transactions.hash": hash }, { "transactions.$": 1 }))
    ?.transactions[0];
  if (transaction) return transaction;

  transaction = (
    await OrphanedBlock.findOne({ "transactions.hash": hash }, { "transactions.$": 1 })
  )?.transactions[0];
  if (transaction) return transaction;

  throw Error("cannot find transaction with hash: " + hash);
};

const getMempoolTxInfo = (locals, transaction) => {
  const inputs = transaction.inputs.map(input => {
    const mempoolUtxos = getMempoolUtxos(locals.mempool);
    const utxo = [...locals.utxos, ...mempoolUtxos].find(
      utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
    );
    if (!utxo) throw Error("Invalid: utxo not found.");
    return { ...input, address: utxo.address, amount: utxo.amount };
  });
  return { ...transaction, inputs, status: "mempool" };
};

export const getTransactionInfo = async (locals, hash, blockHash) => {
  // check if tx is in mempool
  const mempoolTx = locals.mempool.find(tx => tx.hash === hash);
  if (mempoolTx) return getMempoolTxInfo(locals, mempoolTx);

  const transaction = blockHash
    ? await TransactionInfo.findOne({ hash, blockHash }, { _id: false })
    : await TransactionInfo.findOne({ hash }, { _id: false });

  if (!transaction) throw Error("cannot find transaction with hash: " + hash);
  return transaction;
};

export const getMempoolInfo = locals => {
  const mempoolInfo = [];
  const invalidMempool = [];
  for (const transaction of locals.mempool) {
    try {
      const txInfo = getMempoolTxInfo(locals, transaction);
      mempoolInfo.push(txInfo);
    } catch {
      invalidMempool.push(transaction);
    }
  }

  if (invalidMempool.length)
    console.log(
      "Mempool consist of txs that are no longer valid",
      invalidMempool.map(tx => tx.hash)
    );
  return mempoolInfo;
};

export const addTransaction = (locals, transaction, io) => {
  const validation = validatedTransaction(locals, transaction);
  if (validation.code !== RESULT.VALID) return validation;

  locals.mempool.push(transaction);
  MempoolTransaction.create(transaction);

  // broadcast transation to other nodes and all clients.
  io.emit("mempool", {
    mempool: getMempoolInfo(locals),
  });

  return validation;
};

export const getTransactions = (limit = 0, offset = 0) =>
  TransactionInfo.find({}, { _id: false })
    .sort({ timestamp: -1 })
    .skip(offset > 0 ? offset : 0)
    .limit(limit > 0 ? limit : 0);

export const getTransactionCount = () => TransactionInfo.countDocuments({});

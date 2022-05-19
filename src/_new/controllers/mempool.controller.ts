// @ts-nocheck
import { Blocks, BlocksInfo, Utxos, Mempool } from "../models";

export const getMempool = async () => {
  const transactions = await Mempool.find({}, { _id: 0 }).lean();

  const validMempool = [];
  for (const transaction of transactions) {
    let valid = true;
    for (const input of transaction.inputs) {
      const utxo = await Utxos.findOne({ txHash: input.txHash, outIndex: input.outIndex }); // TODO: check from mempool utxo set
      if (!utxo) {
        valid = false;
        break;
      }
      input.address = utxo.address;
      input.amount = utxo.amount;
    }
    if (valid) validMempool.push(transaction);
    else console.log(`txId: ${transaction.hash} is no longer valid.`);
  }

  return validMempool;
};

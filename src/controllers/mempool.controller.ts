import { Blocks, BlocksInfo, Utxos, Mempool } from "../models";
import { TransactionInfo } from "../models/types";

/**
 *
 * @returns sorted valid mempool utxos from latest to earliest
 */
export const getValidMempool = async () => {
  const transactions = (await Mempool.find({}, { _id: 0 })
    .sort({ timestamp: -1 })
    .lean()) as TransactionInfo[];

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
    // else console.log(`Mempool tx: ${transaction.hash} is no longer valid.`);
  }

  return validMempool;
};

export const getValidMempoolForAddresses = async (addresses: string[]) => {
  const mempool = await getValidMempool();
  return mempool.filter(
    tx =>
      tx.inputs.some(input => addresses.includes(input.address)) ||
      tx.outputs.some(output => addresses.includes(output.address))
  );
};

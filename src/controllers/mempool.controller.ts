import { Blocks, BlocksInfo, Utxos, Mempool } from "../models";
import { TransactionInfo } from "../models/types";

/**
 *
 * @returns sorted valid mempool utxos from latest to earliest
 */
export const getValidMempool = async (): Promise<TransactionInfo[]> => {
  const transactions = (await Mempool.find({}, { _id: 0 })
    .sort({ timestamp: 1 }) // earliest to latest
    .lean()) as TransactionInfo[];

  const validMempool = [];
  const validMempoolUtxos = [];
  for (const transaction of transactions) {
    let valid = true;
    for (const input of transaction.inputs) {
      let utxo = await Utxos.findOne({ txHash: input.txHash, outIndex: input.outIndex }); // TODO: check from mempool utxo set

      if (!utxo) {
        // check mempool utxos (inputs not removed)
        utxo = validMempoolUtxos.find(
          utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
        );
      }

      if (!utxo) {
        valid = false;
        break;
      }
      input.address = utxo.address;
      input.amount = utxo.amount;
    }
    if (valid) {
      validMempool.push(transaction);
      for (let i = 0; i < transaction.outputs.length; i++) {
        const output = transaction.outputs[i];
        validMempoolUtxos.push({
          txHash: transaction.hash,
          outIndex: i,
          address: output.address,
          amount: output.amount,
        });
      }
    }
    // else console.log(`Mempool tx: ${transaction.hash} is no longer valid.`);
  }

  return validMempool.reverse();
};

export const getValidMempoolForAddresses = async (addresses: string[]) => {
  const mempool = await getValidMempool();
  return mempool.filter(
    tx =>
      tx.inputs.some(input => addresses.includes(input.address)) ||
      tx.outputs.some(output => addresses.includes(output.address))
  );
};

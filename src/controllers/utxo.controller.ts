import { Utxos } from "../models";
import { Utxo } from "../models/types";
import { getValidMempool } from "../controllers/mempool.controller";

export const getUtxos = () => Utxos.find({}, { _id: 0 });

/**
 *
 * @param addresses
 * @returns all blockchain utxos involving at least one of the addresses
 */
export const getBlockchainUtxosForAddresses = (addresses: string[]) =>
  Utxos.find({ address: { $in: addresses } }, { _id: 0 });

export const getUtxosForAddress = (address: string) => Utxos.find({ address }, { _id: 0 });

export const getMempoolUtxosForAddress = async (address: string): Promise<Utxo[]> => {
  const utxos = (await Utxos.find({ address }, { _id: 0 })) as Utxo[];
  const validMempool = (await getValidMempool()).reverse();

  // mutate utxos with valid mempool
  for (const transaction of validMempool) {
    for (const input of transaction.inputs) {
      if (input.address !== address) continue; // only care about inputs of address

      const utxoIdx = utxos.findIndex(
        utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
      );
      if (utxoIdx < 0) {
        console.error("Fatal: mempool tx is not valid!");
        return [];
      }

      utxos.splice(utxoIdx, 1);
    }
    for (let i = 0; i < transaction.outputs.length; i++) {
      const output = transaction.outputs[i];
      if (output.address !== address) continue; // only care about outputs of address
      utxos.push({
        txHash: transaction.hash,
        outIndex: i,
        address: output.address,
        amount: output.amount,
      });
    }
  }

  return utxos;
};

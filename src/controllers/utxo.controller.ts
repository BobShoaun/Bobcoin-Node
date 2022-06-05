import { BlocksInfo, Utxos } from "../models";
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

// export const getMempoolUtxo = async () => {
//   const blockchainUtxos = await Utxos.find({}, { _id: 0 }).lean();
//   await getValidMempool();
// }

// export const getMempoolUtxoFromInput = async (txHash: string, outIndex: number) => {
//   await getValidMempool();
// };

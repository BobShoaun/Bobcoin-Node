import { Blocks, BlocksInfo, Utxos } from "../models";
import { Block } from "../models/types";

export const findUtxo = async (prevBlockHash: string, txHash: string, outIndex: number) => {
  do {
    const prevBlock = (await Blocks.findOne({ hash: prevBlockHash }).lean()) as Block;
    if (!prevBlock) return null; // reached genesis, not found
    for (const transaction of prevBlock.transactions) {
      if (transaction.inputs.some(input => input.txHash === txHash && input.outIndex === outIndex))
        // utxo is stxo (spent)
        return null;
      if (transaction.hash === txHash) return transaction.outputs[outIndex]; // found utxo
    }
    prevBlockHash = prevBlock.previousHash;
  } while (prevBlockHash);
};

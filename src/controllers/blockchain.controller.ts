import { Blocks, BlocksInfo, Utxos } from "../models";
import { Block } from "../models/types";
import params from "../params";

export const getHeadBlock = async () =>
  (await BlocksInfo.find({ valid: true }, { _id: 0 }).sort({ height: -1 }).limit(1))[0];

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

// calculate difficulty for current block
export const calculateDifficulty = async (height: number, previousHash: string) => {
  const offset = (height - 1) % params.diffRecalcHeight;
  const currRecalcHeight = height - 1 - offset;
  const prevRecalcHeight = currRecalcHeight - params.diffRecalcHeight;

  let currRecalcBlock: Block = {
    previousHash,
    height: -1,
    hash: "",
    timestamp: 0,
    version: "",
    difficulty: 0,
    nonce: 0,
    merkleRoot: "",
    transactions: [],
  };
  do currRecalcBlock = await Blocks.findOne({ hash: currRecalcBlock.previousHash }).lean();
  while (currRecalcBlock.height !== currRecalcHeight);

  let prevRecalcBlock = currRecalcBlock;
  do prevRecalcBlock = await Blocks.findOne({ hash: prevRecalcBlock.previousHash }).lean();
  while (prevRecalcBlock.height !== prevRecalcHeight);

  const timeDiff = (currRecalcBlock.timestamp - prevRecalcBlock.timestamp) / 1000; // divide to get seconds
  const targetTimeDiff = params.diffRecalcHeight * params.targBlkTime; // in seconds
  let correctionFactor = targetTimeDiff / timeDiff;
  correctionFactor = Math.min(correctionFactor, params.maxDiffCorrFact); // clamp correctionfactor
  correctionFactor = Math.max(correctionFactor, params.minDiffCorrFact);
  return (
    Math.round(
      (Math.max(currRecalcBlock.difficulty * correctionFactor, params.initBlkDiff) +
        Number.EPSILON) *
        10000
    ) / 10000
  ); // new difficulty, max 4 decimal places
};

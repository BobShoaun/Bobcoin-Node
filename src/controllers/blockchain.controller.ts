import { Blocks, BlocksInfo } from "../models";
import { Block } from "../models/types";
import params from "../params";

export const getHeadBlock = async () =>
  (await BlocksInfo.find({ valid: true }, { _id: 0 }).sort({ height: -1 }).limit(1))[0];

// calculate difficulty for next block from current block
// TODO: optimize w async iterators
export const calculateDifficulty = async (block: Block) => {
  const offset = block.height % params.diffRecalcHeight;
  const currRecalcHeight = block.height - offset;
  const prevRecalcHeight = currRecalcHeight - params.diffRecalcHeight;

  let currRecalcBlock: Block | any = { previousHash: block.hash };
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

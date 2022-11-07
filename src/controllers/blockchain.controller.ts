import { Blocks, BlocksInfo } from "../models";
import { Block } from "../models/types";
import params from "../params";

export const getHeadBlock = async () =>
  (await BlocksInfo.find({ valid: true }, "-_id").lean().sort({ height: -1 }).limit(1))[0];

// calculate difficulty for next block from current block
export const calculateDifficulty = async ({ height: blockHeight, hash: blockHash }) => {
  if (blockHeight < params.diffRecalcHeight) return params.initBlkDiff; // when its still early

  const offset = blockHeight % params.diffRecalcHeight;
  const currRecalcHeight = blockHeight - offset;
  const prevRecalcHeight = currRecalcHeight - params.diffRecalcHeight;

  let currRecalcBlock: Block | any = { previousHash: blockHash };
  // @ts-ignore
  for await (const currBlock of Blocks.find({ height: { $lte: blockHeight } }).sort({
    height: -1,
  })) {
    if (currRecalcBlock.previousHash !== currBlock.hash) continue;
    currRecalcBlock = currBlock;
    if (currRecalcBlock.height === currRecalcHeight) break;
  }

  let prevRecalcBlock = currRecalcBlock;
  // @ts-ignore
  for await (const currBlock of Blocks.find({ height: { $lte: currRecalcBlock.height } }).sort({
    height: -1,
  })) {
    if (prevRecalcBlock.previousHash !== currBlock.hash) continue;
    prevRecalcBlock = currBlock;
    if (prevRecalcBlock.height === prevRecalcHeight) break;
  }

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

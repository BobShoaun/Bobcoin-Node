import { Blocks, BlocksInfo } from "../models";
import { Block } from "../models/types";
import params from "../params";
import { round4, clamp } from "../helpers/general.helper";

export const getHeadBlock = async () =>
  (await BlocksInfo.find({ valid: true }, "-_id").lean().sort({ height: -1 }).limit(1))[0];

// calculate difficulty for next block from given block
export const calculateNextDifficulty = async ({ height, difficulty, timestamp, previousHash }) => {
  if (height < params.diffRecalcHeight) return params.initBlkDiff; // when its still early
  if (height % params.diffRecalcHeight > 0) return difficulty; // return difficulty of prev block

  const prevRecalcHeight = height - params.diffRecalcHeight;

  let prevRecalcBlock: Block | any = { previousHash };
  do prevRecalcBlock = await Blocks.findOne({ hash: prevRecalcBlock.previousHash }).lean();
  while (prevRecalcBlock.height !== prevRecalcHeight);

  const timeDiff = (timestamp - prevRecalcBlock.timestamp) / 1000; // divide to get seconds
  const targetTimeDiff = params.diffRecalcHeight * params.targBlkTime; // in seconds
  const correctionFactor = clamp(targetTimeDiff / timeDiff, params.minDiffCorrFact, params.maxDiffCorrFact); // clamp correctionfactor
  return round4(Math.max(difficulty * correctionFactor, params.initBlkDiff)); // new difficulty, max 4 decimal places
};

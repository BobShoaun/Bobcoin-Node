// @ts-nocheck
import BlockCrypto from "blockcrypto";

import params from "../params";

import { validateCandidateBlock } from "./blockcrypto";

import {
  OrphanedBlock,
  MatureBlock,
  UnconfirmedBlock,
  MempoolTransaction,
  Utxo,
  TransactionInfo,
} from "../models/index";

const {
  createOutput,
  calculateBlockReward,
  createTransaction,
  calculateTransactionHash,
  calculateHashTarget,
  bigIntToHex64,
  calculateMerkleRoot,
  RESULT,
} = BlockCrypto;

export const testDifficulty = async locals => {
  const blocks = await MatureBlock.find({ height: { $in: [0, 50, 100, 150, 700, 650, 600, 550] } });

  const diffs = [];
  for (const block of blocks) {
    diffs.push(await getDifficulty(locals, block));
  }

  return { diffs, blocks };
};

const getDifficulty = async (locals, headBlock) => {
  if (headBlock.height === 0) return params.initBlkDiff; // genesis
  if (headBlock.height % params.diffRecalcHeight !== 0) return -1;

  // const prevRecalcHeight = headBlock.height - params.diffRecalcHeight;
  const prevRecalcHeight = headBlock.height - 1;
  const prevRecalcBlock = await MatureBlock.findOne({ height: prevRecalcHeight }); // prev block diffRecalcHeight away, assume diffRecalcHeight > blkMaturity

  console.log("head time", headBlock.timestamp, new Date(headBlock.timestamp).getTime());

  const timeDiff = (headBlock.timestamp - prevRecalcBlock.timestamp) / 1000; // divide to get seconds
  const targetTimeDiff = params.diffRecalcHeight * params.targBlkTime; // in seconds
  console.log("recalc", prevRecalcHeight, timeDiff, targetTimeDiff);
  let correctionFactor = targetTimeDiff / timeDiff;
  correctionFactor = Math.min(correctionFactor, params.maxDiffCorrFact); // clamp correctionfactor
  correctionFactor = Math.max(correctionFactor, params.minDiffCorrFact);
  return Math.max(1 * correctionFactor, params.initBlkDiff); // new difficulty
};

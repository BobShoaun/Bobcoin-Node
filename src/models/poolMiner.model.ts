import { Schema } from "mongoose";
import { transactionSchema } from "./block.model";

const candidateBlockSchema = new Schema(
  {
    height: { type: Number, required: true },
    previousHash: { type: String },
    timestamp: { type: Number, required: true },
    version: { type: String, required: true },
    difficulty: { type: Number, required: true },
    merkleRoot: { type: String, required: true },
    transactions: [transactionSchema],
  },
  {
    versionKey: false,
    _id: false,
  }
);

const poolMinerSchema = new Schema(
  {
    address: { type: String, required: true, minLength: 1, unique: true },
    candidateBlock: { type: candidateBlockSchema, required: true },
    shareDifficulty: { type: Number, required: true },
    numShares: { type: Number, required: true, default: 0 },
    previousNonce: { type: Number, required: true, default: -1 },
    totalAcceptedShares: { type: Number, required: true, default: 0 },
    prevShareDiffRecalcTime: { type: Number, required: true, default: 0 },
  },
  {
    versionKey: false,
  }
);

export default poolMinerSchema;

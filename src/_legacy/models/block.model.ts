import mongoose from "mongoose";

// legacy
export const blockSchema = new mongoose.Schema(
  {
    hash: {
      type: String,
      required: true,
      unique: true,
    },
    previousHash: {
      type: String,
    },
    difficulty: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    nonce: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
    version: {
      type: String,
      required: true,
    },
    merkleRoot: {
      type: String,
      required: true,
    },
    transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "transaction" }],
  },
  {
    versionKey: false,
  }
);

const Block = mongoose.model("block", blockSchema);
export default Block;

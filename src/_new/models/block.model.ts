// @ts-nocheck
import { Schema } from "mongoose";

const transactionSchema = new Schema(
  {
    hash: { type: String, required: true },
    timestamp: { type: Number, required: true },
    version: { type: String, required: true },
    inputs: [
      {
        txHash: { type: String, required: true },
        outIndex: { type: Number, required: true },
        publicKey: { type: String, required: true },
        signature: { type: String, required: true },
        address: { type: String, required: true }, // info
        amount: { type: Number, required: true }, // info
        _id: false,
      },
    ],
    outputs: [
      {
        address: { type: String, required: true },
        amount: { type: Number, required: true },
        txHash: { type: String }, // info, for if tx is spent
        _id: false,
      },
    ],
  },
  {
    versionKey: false,
    _id: false,
  }
);

const blockSchema = new Schema(
  {
    valid: { type: Boolean, required: true, default: false },
    height: { type: Number, required: true },
    hash: { type: String, required: true, unique: true },
    previousHash: { type: String },
    timestamp: { type: Number, required: true },
    version: { type: String, required: true },
    difficulty: { type: Number, required: true },
    nonce: { type: Number, required: true },
    merkleRoot: { type: String, required: true },
    transactions: [transactionSchema],
  },
  {
    versionKey: false,
  }
);

export default blockSchema;

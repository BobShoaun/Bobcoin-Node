import { Schema } from "mongoose";
import params from "../params";

export const transactionSchema = new Schema(
  {
    hash: { type: String, required: true },
    timestamp: { type: Number, required: true },
    version: { type: String, required: true },
    message: { type: String, maxLength: params.txMsgMaxLen },
    inputs: [
      {
        txHash: { type: String, required: true },
        outIndex: { type: Number, required: true },
        publicKey: { type: String, required: true },
        signature: { type: String, required: true },
        _id: false,
      },
    ],
    outputs: [
      {
        address: { type: String, required: true },
        amount: { type: Number, required: true },
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

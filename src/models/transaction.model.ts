import { Schema } from "mongoose";
import params from "../params";

const transactionSchema = new Schema(
  {
    hash: { type: String, required: true, unique: true },
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
  }
);

export default transactionSchema;

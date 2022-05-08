import { Schema } from "mongoose";

const utxoSchema = new Schema(
  {
    txHash: { type: String, required: true },
    outIndex: { type: Number, required: true },
    amount: { type: Number, required: true },
    address: { type: String, required: true },
  },
  {
    versionKey: false,
  }
);

utxoSchema.index({ txHash: 1, outIndex: 1 }, { unique: true });

export default utxoSchema;

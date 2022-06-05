import mongoose from "mongoose";

const faucetEntrySchema = new mongoose.Schema(
  {
    address: { type: String, required: true, minLength: 1, unique: true },
    count: { type: Number, required: true, default: 0 }, // will increment by one during creation
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

export default faucetEntrySchema;

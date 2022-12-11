import { Schema } from "mongoose";

const poolRewardSchema = new Schema(
  {
    blockHash: { type: String, required: true, unique: true },
    blockHeight: { type: Number, required: true },
    minerShares: [
      {
        _id: false,
        address: { type: String, required: true }, // should be unique within document array
        numShares: { type: Number, required: true, min: 1 },
      },
    ],
  },
  {
    versionKey: false,
  }
);

export default poolRewardSchema;

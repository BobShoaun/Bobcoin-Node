import mongoose from "mongoose";

const transactionInfoSchema = new mongoose.Schema(
	{
		hash: { type: String, required: true },
		timestamp: { type: Number, required: true },
		version: { type: String, required: true },
		blockHash: { type: String, required: true },
		blockHeight: { type: Number, required: true },
		status: { type: String, required: true },
		inputs: [
			{
				txHash: { type: String, required: true },
				outIndex: { type: Number, required: true },
				publicKey: { type: String, required: true },
				signature: { type: String, required: true },
				address: { type: String, required: true },
				amount: { type: Number, required: true },
				_id: false,
			},
		],
		outputs: [
			{
				address: { type: String, required: true },
				amount: { type: Number, required: true },
				txHash: { type: String },
				_id: false,
			},
		],
	},
	{
		versionKey: false,
	}
);

transactionInfoSchema.index({ hash: 1, blockHash: 1 }, { unique: true });

export default transactionInfoSchema;

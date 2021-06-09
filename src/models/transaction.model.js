import mongoose from "mongoose";

export const transactionSchema = new mongoose.Schema(
	{
		hash: {
			type: String,
			required: true,
			unique: true,
		},
		timestamp: {
			type: Number,
			required: true,
		},
		version: {
			type: String,
			required: true,
		},
		inputs: [
			{
				txHash: {
					type: String,
					required: true,
				},
				outIndex: {
					type: Number,
					required: true,
				},
				publicKey: {
					type: String,
					required: true,
				},
				signature: {
					type: String,
					required: true,
				},
			},
		],
		outputs: [
			{
				address: {
					type: String,
					required: true,
				},
				amount: {
					type: Number,
					required: true,
				},
			},
		],
	},
	{
		timestamps: true,
	}
);

const Transaction = mongoose.model("transaction", transactionSchema);
export default Transaction;

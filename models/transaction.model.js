import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const transactionSchema = new Schema(
	{
		hash: {
			type: String,
			required: true,
			unique: true,
		},
		timestamp: {
			type: Date,
			required: true,
		},
		version: {
			type: Number,
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

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;

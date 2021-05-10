import mongoose from "mongoose";

const Schema = mongoose.Schema;

const transactionSchema = new Schema(
	{
		hash: {
			type: String,
			required: true,
			unique: true,
		},
		signature: {
			type: String,
			required: true,
		},
		inputs: [
			{
				address: {
					type: String,
					required: true,
				},
				amount: {
					type: Number,
					required: true,
				},
				timestamp: {
					type: Date,
					required: true,
				},
				hash: {
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
				timestamp: {
					type: Date,
					required: true,
				},
				hash: {
					type: String,
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

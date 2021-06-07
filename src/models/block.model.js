import mongoose from "mongoose";
import { transactionSchema } from "./transaction.model.js";

const blockSchema = new mongoose.Schema(
	{
		hash: {
			type: String,
			required: true,
			unique: true,
		},
		previousHash: {
			type: String,
		},
		difficulty: {
			type: Number,
			required: true,
		},
		height: {
			type: Number,
			required: true,
		},
		nonce: {
			type: Number,
			required: true,
		},
		timestamp: {
			type: Number,
			required: true,
		},
		version: {
			type: Number,
			required: true,
		},
		// transactions: [{ type: transactionSchema }],
		// transactions: [transactionSchema],
		transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "transaction" }],
	},
	{
		timestamps: true,
	}
);

const Block = mongoose.model("block", blockSchema);
export default Block;

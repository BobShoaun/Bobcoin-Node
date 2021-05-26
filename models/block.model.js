import mongoose from "mongoose";
import { transactionSchema } from "./transaction.model.js";

const Schema = mongoose.Schema;

const blockSchema = new Schema(
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
		transactions: [{ type: transactionSchema }],
	},
	{
		timestamps: true,
	}
);

const Block = mongoose.model("Block", blockSchema);
export default Block;

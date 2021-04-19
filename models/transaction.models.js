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
		sender: {
			type: String,
			required: true,
		},
		recipient: { type: String, required: true },
    amount: {type: Number, required: true },
    fee: {type: Number, required: true}
	},
	{
		timestamps: true,
	}
);

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;

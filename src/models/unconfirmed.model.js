import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
	{
		hash: { type: String, required: true },
		timestamp: { type: Number, required: true },
		version: { type: String, required: true },
		inputs: [
			{
				txHash: { type: String, required: true },
				outIndex: { type: Number, required: true },
				publicKey: { type: String, required: true },
				signature: { type: String, required: true },
				_id: false,
			},
		],
		outputs: [
			{
				address: { type: String, required: true },
				amount: { type: Number, required: true },
				_id: false,
			},
		],
	},
	{
		versionKey: false,
		_id: false,
	}
);

const unconfirmedSchema = new mongoose.Schema(
	{
		block: {
			hash: { type: String, required: true, unique: true },
			previousHash: { type: String },
			difficulty: { type: Number, required: true },
			height: { type: Number, required: true },
			nonce: { type: Number, required: true },
			timestamp: { type: Number, required: true },
			version: { type: String, required: true },
			merkleRoot: { type: String, required: true },
			transactions: [transactionSchema],
		},
		utxos: [
			{
				txHash: { type: String, required: true },
				outIndex: { type: Number, required: true },
				amount: { type: Number, required: true },
				address: { type: String, required: true },
				_id: false,
			},
		],
		mempool: [transactionSchema],
	},
	{
		versionKey: false,
	}
);

export default unconfirmedSchema;

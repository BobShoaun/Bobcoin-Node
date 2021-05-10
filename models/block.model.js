import mongoose from "mongoose";

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
			type: Date,
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

const Block = mongoose.model("Block", blockSchema);
export default Block;

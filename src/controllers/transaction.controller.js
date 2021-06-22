import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Transaction from "../models/transaction.model.js";
import Block from "../models/block.model.js";

const { isTransactionValid, RESULT, calculateMempool, getHighestValidBlock, createBlockchain } =
	BlockCrypto;

export async function getTransactions() {
	return await Transaction.find();
}

export const getMempool = async blockHash => {
	const transactions = await Transaction.find();
	const blockchain = createBlockchain(await Block.find().populate("transactions"));
	const block = blockHash
		? await Block.findOne({ hash: blockHash })
		: getHighestValidBlock(params, blockchain);

	if (!block) throw Error("invalid head block");

	const mempool = calculateMempool(blockchain, block, transactions);
	return mempool;
};

export async function addTransaction(transaction) {
	const transactions = await getTransactions();
	if (isTransactionValid(params, transactions, transaction).code !== RESULT.VALID)
		throw Error("invalid transaction");

	await new Transaction(transaction).save();
}

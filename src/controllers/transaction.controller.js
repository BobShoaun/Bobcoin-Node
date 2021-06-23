import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Transaction from "../models/transaction.model.js";
import Block from "../models/block.model.js";

const {
	isTransactionValid,
	RESULT,
	calculateMempool,
	getHighestValidBlock,
	createBlockchain,
	findTXO,
	isCoinbaseTxValid,
	getBlockConfirmations,
} = BlockCrypto;

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

export const getTransaction = async hash => {
	const transaction = await Transaction.findOne({ hash: hash });
	if (!transaction) throw Error("cannot find transaction with hash: " + hash);
	return transaction;
};

export const getTransactionInfo = async (hash, blockHash) => {
	const transaction = await getTransaction(hash);
	const transactions = await getTransactions();
	const blockchain = createBlockchain(await Block.find().populate("transactions"));

	const totalInput = transaction.inputs.reduce(
		(total, input) => total + findTXO(input, transactions).amount,
		0
	);
	const totalOutput = transaction.outputs.reduce((total, output) => total + output.amount, 0);
	const fee = totalInput - totalOutput;
	const isCoinbase = transaction.inputs.length === 0 && transaction.outputs.length === 1;

	// TODO: find from best chain not entire blockchain, or not?
	const block =
		blockchain.find(block => block.hash === blockHash) ??
		blockchain.find(block => block.transactions.some(tx => tx.hash === hash));
	const confirmations = getBlockConfirmations(params, blockchain, block);

	const validation = isCoinbase
		? isCoinbaseTxValid(params, transaction)
		: isTransactionValid(params, transactions, transaction);

	const isValid = validation.code === RESULT.VALID;

	return { transaction, isValid, block, totalInput, totalOutput, fee, isCoinbase, confirmations };
};

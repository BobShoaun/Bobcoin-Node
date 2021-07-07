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
	calculateUTXOSet,
	calculateMempoolUTXOSet,
	createInput,
	createOutput,
	signTransaction,
	calculateTransactionHash,
} = BlockCrypto;

export async function getTransactions() {
	return await Transaction.find();
}

const getMempoolTxInfo = (transaction, transactions) => {
	const inputInfo = transaction.inputs.map(input => {
		const txo = findTXO(input, transactions);
		return { address: txo.address, amount: txo.amount };
	});
	const totalInput = inputInfo.reduce((total, info) => total + info.amount, 0);

	const totalOutput = transaction.outputs.reduce((total, output) => total + output.amount, 0);
	const fee = totalInput - totalOutput;
	const validation = isTransactionValid(params, transactions, transaction);

	// const headBlock = getHighestValidBlock(params, blockchain);
	// const utxos = calculateUTXOSet(blockchain, headBlock);
	const outputSpent = transaction.outputs.map(() => false);

	return {
		transaction,
		validation,
		totalInput,
		totalOutput,
		fee,
		isCoinbase: false,
		confirmations: 0,
		inputInfo,
		outputSpent,
	};
};

export const getMempool = async blockHash => {
	const transactions = await Transaction.find();
	const blockchain = createBlockchain(await Block.find().populate("transactions"));
	const block = blockHash
		? await Block.findOne({ hash: blockHash })
		: getHighestValidBlock(params, blockchain);

	if (!block) throw Error("invalid head block");

	const mempool = calculateMempool(blockchain, block, transactions);
	return mempool.map(tx => getMempoolTxInfo(tx, transactions));
};

export const addTransaction = async transaction => {
	const transactions = await getTransactions();
	const validation = isTransactionValid(params, transactions, transaction);
	if (validation.code !== RESULT.VALID)
		// invalid transaction
		return { transaction, validation };

	await new Transaction(transaction).save();
	return { transaction, validation };
};

export const getTransaction = async hash => {
	const transaction = await Transaction.findOne({ hash: hash });
	if (!transaction) throw Error("cannot find transaction with hash: " + hash);
	return transaction;
};

export const getTransactionInfo = async (hash, blockHash) => {
	const transaction = await getTransaction(hash);
	const transactions = await getTransactions();
	const blockchain = createBlockchain(await Block.find().populate("transactions"));

	const inputInfo = transaction.inputs.map(input => {
		const txo = findTXO(input, transactions);
		return { address: txo.address, amount: txo.amount };
	});
	const totalInput = inputInfo.reduce((total, info) => total + info.amount, 0);

	const totalOutput = transaction.outputs.reduce((total, output) => total + output.amount, 0);
	const fee = totalInput - totalOutput;
	const isCoinbase = transaction.inputs.length === 0 && transaction.outputs.length === 1;

	// TODO: find from best chain not entire blockchain, or not?
	const block =
		blockchain.find(block => block.hash === blockHash) ??
		blockchain.find(block => block.transactions.some(tx => tx.hash === hash));
	const confirmations = block ? getBlockConfirmations(params, blockchain, block) : 0;

	const validation = isCoinbase
		? isCoinbaseTxValid(params, transaction)
		: isTransactionValid(params, transactions, transaction);

	const isValid = validation.code === RESULT.VALID;

	const headBlock = getHighestValidBlock(params, blockchain);
	const utxos = calculateUTXOSet(blockchain, headBlock);

	const outputSpent = transaction.outputs.map(
		(output, index) =>
			!utxos.some(
				utxo =>
					utxo.address === output.address &&
					utxo.amount === output.amount &&
					utxo.txHash === transaction.hash &&
					utxo.outIndex === index
			)
	);

	return {
		transaction,
		isValid,
		validation,
		block,
		totalInput,
		totalOutput,
		fee,
		isCoinbase,
		confirmations,
		inputInfo,
		outputSpent,
	};
};

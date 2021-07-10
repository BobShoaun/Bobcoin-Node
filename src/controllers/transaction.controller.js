import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Transaction from "../models/transaction.model.js";
import Block from "../models/block.model.js";

import { MempoolTransaction } from "../models/index.js";

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

export const getMempoolInfo = locals =>
	locals.mempool.map(transaction => {
		const inputs = transaction.inputs.map(input => {
			const utxo = locals.utxos.find(
				utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
			);
			return {
				txHash: utxo.txHash,
				outIndex: utxo.outIndex,
				address: utxo.address,
				amount: utxo.amount,
				publicKey: input.publicKey,
				signature: input.signature,
			};
		});

		return {
			transaction,
			inputs,
		};
	});

export const addTransaction = (locals, transaction) => {
	// TODO: validation transaction
	const validation = { code: RESULT.VALID };

	if (validation.code !== RESULT.VALID) throw Error("Rejected: transaction is invalid");

	locals.mempool.push(transaction);
	MempoolTransaction.create(transaction);

	return validation;
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

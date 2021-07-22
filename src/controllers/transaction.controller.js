import { OrphanedBlock, MatureBlock, MempoolTransaction } from "../models/index.js";

import { validatedTransaction } from "./blockcrypto.js";

import BlockCrypto from "blockcrypto";
const { RESULT } = BlockCrypto;

export const getTransaction = async (locals, hash) => {
	let transaction = locals.mempool.find(tx => tx.hash === hash);
	if (transaction) return transaction;

	let block = locals.unconfirmedBlocks.find(block =>
		block.transactions.some(tx => tx.hash === hash)
	);
	if (block) return block.transactions.find(tx => tx.hash === hash);

	block = await MatureBlock.findOne({ "transactions.hash": hash }, { _id: false });
	if (block) return block.transactions.find(tx => tx.hash === hash);

	block = await OrphanedBlock.findOne({ "transactions.hash": hash }, { _id: false });
	if (block) return block.transactions.find(tx => tx.hash === hash);

	throw Error("cannot find transaction with hash: " + hash);
};

export const findTxOutput = async (locals, input) => {
	let utxo = null;

	// find tx in unconfirmedBlocks
	outer: for (const unconfirmedBlock of locals.unconfirmedBlocks) {
		for (const tx of unconfirmedBlock.transactions) {
			if (tx.hash !== input.txHash) continue;
			utxo = tx.outputs[input.outIndex];
			break outer;
		}
	}

	if (utxo) return utxo;

	const block = await MatureBlock.findOne({ "transactions.hash": input.txHash });
	return block.transactions.find(tx => tx.hash === input.txHash).outputs[input.outIndex];
};

const getTxInfoMempool = (locals, hash) => {
	let transaction = locals.mempool.find(tx => tx.hash === hash);
	if (!transaction) return null;
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
	const outputs = transaction.outputs.map(output => ({
		address: output.address,
		amount: output.amount,
		spent: false,
	}));
	return { transaction, inputs, outputs, status: "Mempool" };
};

const getTxInfo = async (locals, block, hash, status) => {
	const transaction = block.transactions.find(tx => tx.hash === hash);

	const inputs = [];
	const outputs = [];

	for (const input of transaction.inputs) {
		const utxo = await findTxOutput(locals, input);
		inputs.push({
			txHash: input.txHash,
			outIndex: input.outIndex,
			address: utxo.address,
			amount: utxo.amount,
			publicKey: input.publicKey,
			signature: input.signature,
		});
	}

	for (let i = 0; i < transaction.outputs.length; i++) {
		const utxo = locals.utxos.find(utxo => utxo.txHash === transaction.hash && utxo.outIndex === i);
		outputs.push({
			address: transaction.outputs[i].address,
			amount: transaction.outputs[i].amount,
			spent: !utxo,
		});
	}

	let confirmations = 0;

	switch (status) {
		case "Unconfirmed":
			confirmations = locals.headBlock.height - block.height + 1; // TODO: not correct for forked blocks
			break;
		case "Confirmed":
			confirmations = locals.headBlock.height - block.height + 1;
			break;
		default:
			confirmations = 0;
	}

	return { transaction, block, inputs, outputs, status, confirmations };
};

export const getTransactionInfo = async (locals, hash) => {
	// check if tx is in mempool
	let info = getTxInfoMempool(locals, hash);
	if (info) return info;

	// check if tx is in unconfirmed blocks
	let block = locals.unconfirmedBlocks.find(block =>
		block.transactions.some(tx => tx.hash === hash)
	);
	if (block) return getTxInfo(locals, block, hash, "Unconfirmed");

	// check if tx is in mature blocks
	block = await MatureBlock.findOne({ "transactions.hash": hash }, { _id: false });
	if (block) return getTxInfo(locals, block, hash, "Confirmed");

	// check if tx is orphaned
	block = await OrphanedBlock.findOne({ "transactions.hash": hash }, { _id: false });
	if (block) return getTxInfo(locals, block, hash, "Orphaned");

	throw Error("cannot find transaction with hash: " + hash);
};

export const getMempoolInfo = locals => {
	const mempoolInfo = [];
	const invalidMempool = [];
	outer: for (const transaction of locals.mempool) {
		const inputs = [];
		for (const input of transaction.inputs) {
			const utxo = locals.utxos.find(
				utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
			);
			if (!utxo) {
				invalidMempool.push(transaction);
				continue outer;
			}
			inputs.push({
				txHash: utxo.txHash,
				outIndex: utxo.outIndex,
				address: utxo.address,
				amount: utxo.amount,
				publicKey: input.publicKey,
				signature: input.signature,
			});
		}

		const outputs = transaction.outputs.map(output => ({
			address: output.address,
			amount: output.amount,
			spent: false,
		}));
		mempoolInfo.push({ transaction, inputs, outputs });
	}

	if (invalidMempool.length)
		console.log(
			"Mempool consist of txs that are no longer valid",
			invalidMempool.map(tx => tx.hash)
		);
	return mempoolInfo;
};

export const addTransaction = (locals, transaction, io) => {
	const validation = validatedTransaction(locals, transaction);
	if (validation.code !== RESULT.VALID) return validation;

	locals.mempool.push(transaction);
	MempoolTransaction.create(transaction);

	// broadcast transation to other nodes and all clients.
	io.emit("mempool", {
		mempool: getMempoolInfo(locals),
	});

	return validation;
};

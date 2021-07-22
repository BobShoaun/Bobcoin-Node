import { MatureBlock } from "../models/index.js";

import { findTxOutput } from "./transaction.controller.js";

const getTxInfo = async (locals, transaction) => {
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

	return { transaction, inputs, outputs };
};

export const getAddressInfo = async (locals, address) => {
	const utxos = locals.utxos.filter(utxo => utxo.address === address);

	const transactionsInfo = [];

	for (const block of locals.unconfirmedBlocks) {
		for (const tx of block.transactions) {
			if (tx.outputs.some(output => output.address === address)) {
				const info = await getTxInfo(locals, tx);
				transactionsInfo.push({
					...info,
					confirmations: locals.headBlock.height - block.height + 1,
				});
				continue;
			}
		}
	}

	const blocks = await MatureBlock.find(
		{ "transactions.outputs.address": address },
		{ _id: false }
	);
	for (const block of blocks) {
		for (const tx of block.transactions) {
			if (tx.outputs.some(output => output.address === address)) {
				const info = await getTxInfo(locals, tx);
				transactionsInfo.push({
					...info,
					confirmations: locals.headBlock.height - block.height + 1,
				});
				continue;
			}
		}
	}

	return { utxos, transactionsInfo };
};

export const getWalletInfo = async (locals, addresses) => {
	const utxos = locals.utxos.filter(utxo => addresses.includes(utxo.address));

	const transactionsInfo = [];

	for (const block of locals.unconfirmedBlocks) {
		for (const tx of block.transactions) {
			if (tx.outputs.some(output => addresses.includes(output.address))) {
				const info = await getTxInfo(locals, tx);
				transactionsInfo.push({
					...info,
					confirmations: locals.headBlock.height - block.height + 1,
				});
				continue;
			}
		}
	}

	const blocks = await MatureBlock.find(
		{ "transactions.outputs.address": { $in: addresses } },
		{ _id: false }
	);
	for (const block of blocks) {
		for (const tx of block.transactions) {
			if (tx.outputs.some(output => addresses.includes(output.address))) {
				const info = await getTxInfo(locals, tx);
				transactionsInfo.push({
					...info,
					confirmations: locals.headBlock.height - block.height + 1,
				});
				continue;
			}
		}
	}

	return { utxos, transactionsInfo };
};

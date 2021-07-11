import { findTxOutput } from "./transaction.controller.js";

import { OrphanedBlock, MatureBlock } from "../models/index.js";

// export const mineGenesis = async address => {
// 	const output = createOutput(address, params.initBlkReward);
// 	const coinbase = createTransaction(params, [], [output]);
// 	coinbase.hash = calculateTransactionHash(coinbase);
// 	const genesis = mineGenesisBlock(params, [coinbase]);

// 	await addBlock(genesis);
// 	return genesis;
// };

export const getBlock = async (locals, hash) => {
	let block = locals.unconfirmedBlocks.find(block => block.hash === hash);
	if (block) return { block, status: "Unconfirmed" };
	block = await MatureBlock.findOne({ hash }, { _id: false });
	if (block) return { block, status: "Confirmed" };
	block = await OrphanedBlock.findOne({ hash }, { _id: false });
	if (block) return { block, status: "Orphaned" };
	throw Error("cannot find block with hash: " + hash);
};

export const getBlockInfo = async (locals, hash) => {
	const { block, status } = await getBlock(locals, hash);

	const transactionsInfo = [];

	for (const transaction of block.transactions) {
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
			const utxo = locals.utxos.find(
				utxo => utxo.txHash === transaction.hash && utxo.outIndex === i
			);
			outputs.push({
				address: transaction.outputs[i].address,
				amount: transaction.outputs[i].amount,
				spent: !utxo,
			});
		}

		transactionsInfo.push({ transaction, inputs, outputs });
	}

	let confirmations = 0;

	switch (status) {
		case "Unconfirmed":
			confirmations = locals.headBlock.height - block.height + 1; // TODO: not correct for forked blocks
			break;
		case "Confirmed":
			confirmations = locals.headBlock.height - block.height + 1;
			break;
		case "Orphaned":
			confirmations = 1;
			break;
		default:
			confirmations = 0;
	}

	return {
		block,
		transactionsInfo,
		confirmations,
		status,
	};
};

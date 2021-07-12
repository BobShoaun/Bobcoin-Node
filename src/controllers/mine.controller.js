import BlockCrypto from "blockcrypto";

import params from "../params.js";

import { validateCandidateBlock } from "./blockcrypto.js";

const {
	createOutput,
	calculateBlockReward,
	createTransaction,
	calculateTransactionHash,
	calculateHashTarget,
	bigIntToHex64,
	calculateMerkleRoot,
	RESULT,
} = BlockCrypto;

export const getMiningInfo = locals => ({
	headBlock: locals.headBlock,
	mempool: locals.mempool,
	unconfirmedBlocks: locals.unconfirmedBlocks,
});

export const createCandidateBlock = async (locals, previousBlock, transactions, miner) => {
	let totalInput = 0;
	let totalOutput = 0;
	for (const transaction of transactions) {
		for (const input of transaction.inputs) {
			const utxo = locals.utxos.find(
				utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
			);
			totalInput += utxo.amount;
		}
		for (const output of transaction.outputs) totalOutput += output.amount;
	}

	const fees = totalInput - totalOutput;
	const output = createOutput(miner, calculateBlockReward(params, previousBlock.height + 1) + fees);
	const coinbase = createTransaction(params, [], [output]);
	coinbase.hash = calculateTransactionHash(coinbase);
	const block = createBlock(params, previousBlock, [coinbase, ...transactions], locals.difficulty);
	const target = bigIntToHex64(calculateHashTarget(params, block));

	const validation = validateCandidateBlock(locals, block);
	return { block, target, validation };
};

const createBlock = (params, previousBlock, transactions, difficulty) => ({
	height: previousBlock.height + 1,
	previousHash: previousBlock.hash,
	transactions,
	timestamp: Date.now(),
	version: params.version,
	difficulty,
	merkleRoot: calculateMerkleRoot(transactions.map(tx => tx.hash)),
	nonce: 0,
});

import BlockCrypto from "blockcrypto";

import params from "../params.js";

const {
	createBlockchain,
	getTransactionFees,
	createOutput,
	calculateBlockReward,
	createTransaction,
	calculateTransactionHash,
	calculateHashTarget,
	isBlockValidInBlockchain,
	addBlock,
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
	// TODO: validate first

	let totalInput = 0;
	let totalOutput = 0;
	for (const tx of transactions) {
		for (const input of tx.inputs) {
			const utxo = locals.utxos.find(
				utxo => utxo.txHash === input.txHash && utxo.outInput === input.outIndex
			);
			if (!utxo) throw Error("Utxo does not exist");
			totalInput += utxo.amount;
		}
		for (const output of tx.outputs) totalOutput += output.amount;
	}

	const fees = totalInput - totalOutput;
	const output = createOutput(miner, calculateBlockReward(params, previousBlock.height + 1) + fees);
	const coinbase = createTransaction(params, [], [output]);
	coinbase.hash = calculateTransactionHash(coinbase);
	const block = createBlock(params, previousBlock, [coinbase, ...transactions], locals.difficulty);
	const target = bigIntToHex64(calculateHashTarget(params, block));

	const validation = { code: RESULT.VALID };
	return { block, target, validation };
};

const createBlock = (params, previousBlock, transactions, difficulty) => {
	const block = {
		height: previousBlock.height + 1,
		previousHash: previousBlock.hash,
		transactions,
		timestamp: Date.now(),
		version: params.version,
		difficulty,
		merkleRoot: calculateMerkleRoot(transactions.map(tx => tx.hash)),
		nonce: 0,
	};
	return block;
};

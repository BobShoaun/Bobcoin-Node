import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Block from "../models/block.model.js";
import {
	OrphanedBlock,
	MatureBlock,
	UnconfirmedBlock,
	MempoolTransaction,
	Utxo,
} from "../models/index.js";

const { createBlockchain, getHighestValidBlock, getBestChain, calculateUTXOSet, calculateMempool } =
	BlockCrypto;

export const cleanBlock = block => ({
	height: block.height,
	hash: block.hash,
	previousHash: block.previousHash,
	timestamp: block.timestamp,
	version: block.version,
	difficulty: block.difficulty,
	nonce: block.nonce,
	merkleRoot: block.merkleRoot,
	transactions: block.transactions.map(tx => ({
		hash: tx.hash,
		timestamp: tx.timestamp,
		version: tx.version,
		inputs: tx.inputs,
		outputs: tx.outputs,
	})),
});

export const resetMigration = () => {
	OrphanedBlock.deleteMany().then();
	MatureBlock.deleteMany().then();
	UnconfirmedBlock.deleteMany().then();
	MempoolTransaction.deleteMany().then();
	Utxo.deleteMany().then();
};

export const phase2 = async () => {
	const blockchain = await MatureBlock.find().sort({ height: 1 });
	const transactions = blockchain.flatMap(block => block.transactions);

	for (let i = 0; i < params.blkMaturity - 1; i++) {
		const headBlock = blockchain.pop();
		MatureBlock.deleteOne({ _id: headBlock._id }).then();
		new UnconfirmedBlock(cleanBlock(headBlock)).save();
	}
	const headBlock = getHighestValidBlock(params, blockchain);
	const utxos = calculateUTXOSet(blockchain, headBlock);
	const mempool = calculateMempool(blockchain, headBlock, transactions);

	MempoolTransaction.insertMany(mempool);
	Utxo.insertMany(utxos);
};

export const phase1 = async () => {
	let blockchain = createBlockchain(await Block.find({}, { _id: false }).populate("transactions"));
	let bestchain = getBestChain(params, blockchain);

	const orphanedBlocks = blockchain.filter(block => !bestchain.some(b => b.hash === block.hash));
	OrphanedBlock.insertMany(orphanedBlocks.map(cleanBlock));
	MatureBlock.insertMany(bestchain.map(cleanBlock));
};

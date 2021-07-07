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

const cleanBlock = block => ({
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
		inputs: tx.inputs,
		outputs: tx.outputs,
		timestamp: tx.timestamp,
		version: tx.version,
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
	let blockchain = await MatureBlock.find().populate("transactions").sort({ height: 1 });
	const transactions = blockchain.flatMap(block => block.transactions);

	let i = 0;
	for (; i < params.blkMaturity - 1; i++) {
		const headBlock = getHighestValidBlock(params, blockchain);
		MatureBlock.deleteOne({ _id: headBlock._id }).then();

		new UnconfirmedBlock(cleanBlock(headBlock)).save();
		blockchain.pop();
	}
	if (i === params.blkMaturity - 1) {
		const headBlock = getHighestValidBlock(params, blockchain);
		const utxos = calculateUTXOSet(blockchain, headBlock);
		const mempool = calculateMempool(blockchain, headBlock, transactions);

		MempoolTransaction.insertMany(mempool);
		Utxo.insertMany(utxos);
	}
};

export const phase1 = async () => {
	let blockchain = createBlockchain(await Block.find({}, { _id: false }).populate("transactions"));
	let bestchain = getBestChain(params, blockchain);

	for (const block of blockchain) {
		if (!bestchain.some(b => b.hash === block.hash)) {
			// orphan
			new OrphanedBlock(cleanBlock(block)).save();
		}
	}

	for (const block of bestchain) {
		new MatureBlock(cleanBlock(block)).save();
	}
};

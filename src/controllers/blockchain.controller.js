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

const { createBlockchain, getHighestValidBlock, isBlockValidInBlockchain, RESULT } = BlockCrypto;

export let headBlock = null;
export let unconfirmedBlocks = []; // sorted by descending height
export let mempool = []; // mempool as of headblock, recalc with reorg
export let utxos = []; // utxos as of headblock, recalc with reorg

const insertUnconfirmedBlock = block => {
	for (let i = 0; i < unconfirmedBlocks.length; i++) {
		if (block.height >= unconfirmedBlocks[i].height) {
			unconfirmedBlocks.splice(i, 0, block);
			break;
		}
	}
};

// called after head block is updated
const removeConfirmedBlocks = () => {
	// remove confirmed blocks from pool and add to persistent db
	const confirmedHeight = headBlock.height - params.blkMaturity + 1;
	let lastBlock = headBlock;
	let currentHash = headBlock.previousHash;
	const orphanedIndices = [];
	for (let i = 0; i < unconfirmedBlocks.length; i++) {
		if (unconfirmedBlocks[i].hash === currentHash) {
			lastBlock = unconfirmedBlocks[i];
			currentHash = unconfirmedBlocks[i].previousHash;
			continue;
		}
		// for orphaned blocks
		if (unconfirmedBlocks[i].height === confirmedHeight) orphanedIndices.push(i); // confirmed orphaned
	}

	// put to orphaned pool
	for (let i = orphanedIndices.length - 1; i >= 0; i--) {
		new OrphanedBlock(unconfirmedBlocks[i]).save();
		unconfirmedBlocks.splice(orphanedIndices[i], 1);
	}

	if (lastBlock.height !== confirmedHeight)
		throw Error("something is wrong w the unconfirmed blocks array!");

	// put to best chain, mature blocks
	new MatureBlock(lastBlock).save();
	unconfirmedBlocks.splice(unconfirmedBlocks.indexOf(lastBlock), 1);
};

const updateMempoolAndUtxos = block => {
	for (const transaction of block.transactions) {
		// update mempool, remove txs in block frm mempool
		mempool = mempool.filter(tx => tx.hash === transaction.hash);

		// remove spent utxos
		outer: for (const input of transaction.inputs) {
			for (let i = 0; i < utxos.length; i++) {
				if (utxos[i].txHash === input.txHash && utxos[i].outIndex === input.outIndex) {
					utxos.splice(i, 1);
					continue outer;
				}
			}
			// utxo does not exist
			throw Error("Attempt to spend utxo that doesn't exist");
		}

		// insert new utxos
		for (let i = 0; i < transaction.outputs.length; i++) {
			utxos.push({
				txHash: transaction.hash,
				outIndex: i,
				address: transaction.outputs[i].address,
				amount: transaction.outputs[i].amount,
			});
		}
	}
};

const recalcMempoolAndUtxos = async () => {
	utxos = await Utxo.find({}, { _id: false });
	mempool = await MempoolTransaction.find({}, { _id: false });
	const bestchain = [headBlock];

	let currentHash = headBlock.previousHash;
	for (let i = 0; i < unconfirmedBlocks.length; i++) {
		if (unconfirmedBlocks[i].hash !== currentHash) continue;
		currentHash = unconfirmedBlocks[i].previousHash;
		bestchain.push(unconfirmedBlocks[i]);
	}

	for (let i = bestchain.length - 1; i >= 0; i--) updateMempoolAndUtxos(bestchain[i]);
};

export const addBlock = (block, io) => {
	// check if mining from unconfirmed block
	const previousBlock = unconfirmedBlocks.find(b => b.hash === block.previousHash);
	if (!previousBlock) throw Error("Previous block not within unconfirmed pool.");

	if (!validateBlock(block)) throw Error("Rejected: Block is invalid");

	const isNewHead = block.height === headBlock.height + 1;
	const isReorg = previousBlock !== headBlock;

	if (isNewHead) {
		headBlock = block;
		// remove last block(s) which are now confirmed
		removeConfirmedBlocks();
	}

	insertUnconfirmedBlock(block);

	if (isNewHead) {
		// forked, new head block, call for reorg
		if (isReorg) recalcMempoolAndUtxos();
		else updateMempoolAndUtxos(block);
	}

	// broadcast block to other nodes and clients.
};

export const setupUnconfirmed = async () => {
	unconfirmedBlocks = await UnconfirmedBlock.find({}, { _id: false }).sort({ height: -1 });
	// choose heighest block with lowest timestamp
	const highest = unconfirmedBlocks[0].height;
	let earliestBlock = unconfirmedBlocks[0];
	for (const block of unconfirmedBlocks) {
		if (block.height !== highest) break;
		if (earliestBlock.timestamp > block.timestamp) earliestBlock = block;
	}

	headBlock = earliestBlock;
	await recalcMempoolAndUtxos();
};

const dumpUnconfirmed = async () => {
	// dump unconfirmed blocks into persistent
	await UnconfirmedBlock.deleteMany();
	await UnconfirmedBlock.insertMany(unconfirmedBlocks);
};

const validateBlock = block => {
	return true;
};

export const getHeadBlock = () => headBlock;

export const getBlockchainNew = async (limit, height) => {
	const maxHeight = height;
	const minHeight = height - limit; // exclusive
	const unconfirmed = unconfirmedBlocks.filter(
		block => block.height <= maxHeight && block.height > minHeight
	);
	const matured = await MatureBlock.find({
		height: { $lte: maxHeight },
		height: { $gt: minHeight },
	});
	const orphaned = await OrphanedBlock.find({
		height: { $lte: maxHeight },
		height: { $gt: minHeight },
	});
	return [
		...unconfirmed.map(block => ({ block, status: "unconfirmed" })),
		...matured.map(block => ({ block, status: "confirmed" })),
		...orphaned.map(block => ({ block, status: "orphaned" })),
	];
};

// -------

export const getBlockchain = async (limit, height, timestamp) => {
	const query = height
		? {
				$or: [{ height: { $lt: height } }, { height: height, timestamp: { $lt: timestamp } }],
		  }
		: {};
	const blocks = await Block.find(query)
		.sort({ height: -1, timestamp: -1 })
		.limit(limit)
		.populate("transactions");
	return blocks;
};

export const getBlockchainInfo = async (limit, height, timestamp) => {
	const blockchain = createBlockchain(await Block.find().populate("transactions"));
	const reversed = [...blockchain].reverse();
	const headBlock = getHighestValidBlock(params, blockchain);

	const getBestChainHashes = () => {
		const hashes = [];
		let currentBlkHash = headBlock.hash;
		for (const block of reversed) {
			if (block.hash !== currentBlkHash) continue;
			hashes.push(block.hash);
			currentBlkHash = block.previousHash;
		}
		return hashes;
	};
	const bestChainHashes = getBestChainHashes();

	const blockchainInfo = reversed.map(block => {
		let status = "";
		if (headBlock.height - block.height + 1 < params.blkMaturity) status = "Unconfirmed";
		else if (bestChainHashes.includes(block.hash)) status = "Confirmed";
		else status = "Orphaned";

		const validation = isBlockValidInBlockchain(params, blockchain, block);
		const isValid = validation.code === RESULT.VALID;
		return { block, isValid, status, validation };
	});

	const paginated =
		isNaN(height) || isNaN(timestamp)
			? blockchainInfo
			: blockchainInfo.filter(
					({ block }) =>
						block.height < height || (block.height === height && block.timestamp < timestamp)
			  );

	return paginated.slice(0, isNaN(limit) ? paginated.length : limit);
};

export const getBestBlock = async () => {
	const blockchain = createBlockchain(await Block.find().populate("transactions"));
	const headBlock = getHighestValidBlock(params, blockchain);
	return headBlock;
};

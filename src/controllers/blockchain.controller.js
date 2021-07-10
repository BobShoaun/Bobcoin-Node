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

import { cleanBlock } from "./migrate.controller.js";
import { getMempoolInfo } from "./transaction.controller.js";

const { createBlockchain, getHighestValidBlock, isBlockValidInBlockchain, RESULT } = BlockCrypto;

const insertUnconfirmedBlock = (locals, block) => {
	for (let i = 0; i < locals.unconfirmedBlocks.length; i++) {
		if (block.height >= locals.unconfirmedBlocks[i].height) {
			locals.unconfirmedBlocks.splice(i, 0, block);
			break;
		}
	}
};

// called after head block is updated
const removeConfirmedBlocks = async locals => {
	// remove confirmed blocks from pool and add to persistent db
	const confirmedHeight = locals.headBlock.height - params.blkMaturity + 1;
	let lastBlock = locals.headBlock;
	let currentHash = locals.headBlock.previousHash;
	const orphanedIndices = [];
	for (let i = 0; i < locals.unconfirmedBlocks.length; i++) {
		if (locals.unconfirmedBlocks[i].hash === currentHash) {
			lastBlock = locals.unconfirmedBlocks[i];
			currentHash = locals.unconfirmedBlocks[i].previousHash;
			continue;
		}
		// for orphaned blocks
		if (locals.unconfirmedBlocks[i].height === confirmedHeight) orphanedIndices.push(i); // confirmed orphaned
	}

	// put to orphaned pool
	for (let i = orphanedIndices.length - 1; i >= 0; i--) {
		await OrphanedBlock.create(cleanBlock(locals.unconfirmedBlocks[i]));
		locals.unconfirmedBlocks.splice(orphanedIndices[i], 1);
	}

	if (lastBlock.height !== confirmedHeight)
		throw Error("something is wrong w the unconfirmed blocks array!");

	// remove tx frm mempool
	await MempoolTransaction.deleteMany({
		hash: { $in: lastBlock.transactions.slice(1).map(tx => tx.hash) },
	});

	// update utxo
	const inputsDelete = [];
	const outputsInsert = [];
	for (let i = 0; i < lastBlock.transactions.length; i++) {
		inputsDelete.push(...lastBlock.transactions[i].inputs);
		for (let j = 0; j < lastBlock.transactions[i].outputs.length; j++) {
			outputsInsert.push({
				txHash: lastBlock.transactions[i].hash,
				outIndex: j,
				address: lastBlock.transactions[i].outputs[j].address,
				amount: lastBlock.transactions[i].outputs[j].amount,
			});
		}
	}

	for (const input of inputsDelete)
		await Utxo.deleteOne({ txHash: input.txHash, outIndex: input.outIndex });

	await Utxo.insertMany(outputsInsert);

	// put to best chain, mature blocks
	await MatureBlock.create(cleanBlock(lastBlock));
	locals.unconfirmedBlocks.splice(locals.unconfirmedBlocks.indexOf(lastBlock), 1);
};

const updateMempoolAndUtxos = (locals, block) => {
	for (const transaction of block.transactions) {
		// update mempool, remove txs in block frm mempool
		locals.mempool = locals.mempool.filter(tx => tx.hash !== transaction.hash);

		// remove spent utxos
		outer: for (const input of transaction.inputs) {
			for (let i = 0; i < locals.utxos.length; i++) {
				if (
					locals.utxos[i].txHash === input.txHash &&
					locals.utxos[i].outIndex === input.outIndex
				) {
					locals.utxos.splice(i, 1);
					continue outer;
				}
			}
			// utxo does not exist
			throw Error("Attempt to spend utxo that doesn't exist");
		}

		// insert new utxos
		for (let i = 0; i < transaction.outputs.length; i++) {
			locals.utxos.push({
				txHash: transaction.hash,
				outIndex: i,
				address: transaction.outputs[i].address,
				amount: transaction.outputs[i].amount,
			});
		}
	}
};

const recalcMempoolAndUtxos = async locals => {
	locals.utxos = await Utxo.find({}, { _id: false });
	locals.mempool = await MempoolTransaction.find({}, { _id: false });
	const bestchain = [locals.headBlock];

	let currentHash = locals.headBlock.previousHash;
	for (let i = 0; i < locals.unconfirmedBlocks.length; i++) {
		if (locals.unconfirmedBlocks[i].hash !== currentHash) continue;
		currentHash = locals.unconfirmedBlocks[i].previousHash;
		bestchain.push(locals.unconfirmedBlocks[i]);
	}

	for (let i = bestchain.length - 1; i >= 0; i--) updateMempoolAndUtxos(locals, bestchain[i]);
};

const updateDifficulty = async (locals, previousBlock) => {
	if (locals.headBlock.height === 0) return (locals.difficulty = params.initBlkDiff); // genesis
	if (locals.headBlock.height % params.diffRecalcHeight !== 0)
		return (locals.difficulty = previousBlock.difficulty);

	const prevRecalcHeight = locals.headBlock.height - params.diffRecalcHeight;
	const prevRecalcBlock = await MatureBlock.findOne({ height: prevRecalcHeight }); // prev block diffRecalcHeight away, assume diffRecalcHeight > blkMaturity

	const timeDiff = locals.headBlock.timestamp - prevRecalcBlock.timestamp;
	const targetTimeDiff = params.diffRecalcHeight * params.targBlkTime; // in seconds
	let correctionFactor = targetTimeDiff / timeDiff;
	correctionFactor = Math.min(correctionFactor, params.maxDiffCorrFact); // clamp correctionfactor
	correctionFactor = Math.max(correctionFactor, params.minDiffCorrFact);
	locals.difficulty = Math.max(previousBlock.difficulty * correctionFactor, params.initBlkDiff); // new difficulty
};

export const addBlock = async (locals, block, io) => {
	// check if mining from unconfirmed block
	const previousBlock = locals.unconfirmedBlocks.find(b => b.hash === block.previousHash);
	if (!previousBlock) throw Error("Previous block not within unconfirmed pool.");

	const validation = validateBlock(block);
	if (validation.code !== RESULT.VALID) throw Error("Rejected: Block is invalid");

	const isNewHead = block.height === locals.headBlock.height + 1;
	const isReorg = previousBlock !== locals.headBlock;

	if (isNewHead) {
		locals.headBlock = block;
		// remove last block(s) which are now confirmed
		await removeConfirmedBlocks(locals);
	}

	insertUnconfirmedBlock(locals, block);

	if (isNewHead) {
		// forked, new head block, call for reorg
		if (isReorg) await recalcMempoolAndUtxos(locals);
		else updateMempoolAndUtxos(locals, block);
		updateDifficulty(locals, previousBlock);
	}

	saveUnconfirmedBlocks(locals);

	// broadcast block to other nodes and all clients.
	io.emit("block", {
		headBlock: locals.headBlock,
		mempool: getMempoolInfo(locals),
		unconfirmedBlocks: locals.unconfirmedBlocks,
	});

	return validation;
};

export const setupUnconfirmedBlocks = async locals => {
	locals.unconfirmedBlocks = await UnconfirmedBlock.find({}, { _id: false }).sort({ height: -1 });
	// choose heighest block with lowest timestamp
	const highest = locals.unconfirmedBlocks[0].height;
	let earliestBlock = locals.unconfirmedBlocks[0];
	for (const block of locals.unconfirmedBlocks) {
		if (block.height !== highest) break;
		if (earliestBlock.timestamp > block.timestamp) earliestBlock = block;
	}

	locals.headBlock = earliestBlock;
	await recalcMempoolAndUtxos(locals);
	await updateDifficulty(
		locals,
		locals.unconfirmedBlocks.find(block => block.hash === locals.headBlock.previousHash)
	);
};

export const saveUnconfirmedBlocks = async locals => {
	// dump unconfirmed blocks into persistent
	await UnconfirmedBlock.deleteMany();
	await UnconfirmedBlock.insertMany(locals.unconfirmedBlocks);
};

const validateBlock = block => {
	return { code: RESULT.VALID };
};

export const getBlockchainNew = async (locals, limit, height) => {
	const maxHeight = height;
	const minHeight = height - limit; // exclusive
	const unconfirmed = locals.unconfirmedBlocks.filter(
		block => block.height <= maxHeight && block.height > minHeight
	);
	const matured = await MatureBlock.find({
		height: { $lte: maxHeight },
		height: { $gt: minHeight },
	}).sort({ height: -1 });
	const orphaned = await OrphanedBlock.find({
		height: { $lte: maxHeight },
		height: { $gt: minHeight },
	}).sort({ height: -1 });
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

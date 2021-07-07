import BlockCrypto from "blockcrypto";
import Mongoose from "mongoose";

import params from "../params.js";
import Block from "../models/block.model.js";
import {
	OrphanedBlock,
	MatureBlock,
	UnconfirmedBlock,
	MempoolTransaction,
	Utxo,
} from "../models/index.js";

const {
	createBlockchain,
	getHighestValidBlock,
	isBlockValidInBlockchain,
	RESULT,
	getBestChain,
	calculateUTXOSet,
	calculateMempool,
} = BlockCrypto;

let headBlock = null;
let unconfirmedBlocks = []; // sorted by descending height
let mempool = []; // mempool as of headblock, recalc with reorg
let utxos = []; // utxos as of headblock, recalc with reorg

const insertUnconfirmedBlock = block => {
	for (let i = 0; i < unconfirmedBlocks.length; i++) {
		if (block.height >= unconfirmedBlocks[i].height) {
			unconfirmedBlocks.splice(i, 0, block);
			break;
		}
	}
}

const setHeadBlock = () => {

}

const setHeadBlockReorg = () => {

}

const setup = async () => {
  const unconfirmedBlocks = await UnconfirmedBlock.find({}, { _id: false }).sort({ height: -1 });
  const headBlock = {}; // find headblck
}

const close = async () => {
  // dump unconfirmed blocks into persistent
  await UnconfirmedBlock.deleteMany();
  await UnconfirmedBlock.insertMany(unconfirmedBlocks);
}

const addBlock = block => {
	// check if mining from unconfirmed block
	const unconfirmedBlock = unconfirmedBlocks.find(b => b.hash === block.previousHash);
	if (!unconfirmedBlock) throw Error("Previous block not within unconfirmed pool.");

	if (!validateBlock(block)) throw Error("Rejected: Block is invalid");

  if (block.height === headBlock.height + 1) {
    // new head block
    
    if (unconfirmedBlock !== headBlock) {
      // forked, new head block, call for reorg
    }
  }

  if (block.height <= headBlock.height) {
    // useless forked block
    insertUnconfirmedBlock(block);
    return;
  }

  // update headblock, no reorg
  if (unconfirmedBlock === headBlock) {

  }

	// update mempool, remove txs in block frm mempool
	let newMempool = unconfirmedBlock.mempool;
	for (const transaction of block.transactions)
		newMempool = newMempool.filter(tx => tx.hash === transaction.hash);

	// update utxos
	let newUtxos = unconfirmedBlock.utxos;
	for (const transaction of block.transactions) {
		for (const input of transaction.inputs) {
			let i = 0;
			for (; i < newUtxos.length; i++) {
				if (newUtxos[i].txHash === input.txHash && newUtxos[i].outIndex === input.outIndex) {
					newUtxos.splice(i, 1);
					break;
				}
			}
			if (i >= newUtxos.length)
				// utxo does not exist
				throw Error("Attempt to spend utxo that doesn't exist");
		}
		for (let i = 0; i < transaction.outputs.length; i++) {
			newUtxos.push({
				txHash: transaction.hash,
				outIndex: i,
				address: output.address,
				amount: output.amount,
			});
		}
	}

	// check if it replaces current headBlock
	if (block.height === headBlock.height + 1) {
		headBlock = block;

		// remove confirmed blocks from pool and add to persistent db
		const confirmedHeight = headBlock.height - params.blkMaturity + 1;
		let lastBlock = headBlock;
		let currentHash = headBlock.previousHash;
		const orphanedIndices = [];
		for (let i = 0; i < unconfirmedPool.length; i++) {
			const unconfirmedBlock = unconfirmedPool[i].block;
			if (unconfirmedBlock.hash === currentHash) {
				lastBlock = unconfirmedBlock;
				currentHash = unconfirmedBlock.previousHash;
				continue;
			}
			// for orphaned blocks
			if (unconfirmedBlock.height === confirmedHeight) orphanedIndices.push(i); // confirmed orphaned
		}

		// put to orphaned pool
		for (let i = orphanedIndices.length - 1; i >= 0; i--) {
			new OrphanedBlock(unconfirmedPool[i].block).save();
			unconfirmedPool.splice(orphanedIndices[i], 1);
		}

		if (lastBlock.height !== confirmedHeight)
			throw Error("something is wrong w the unconfirmed pool!");

		// put to best chain, mature blocks
		new MatureBlock(lastBlock).save();
		for (let i = 0; i < unconfirmedPool.length; i++) {
			if (unconfirmedPool[i].block === lastBlock) {
				unconfirmedPool.splice(i, 1);
				break;
			}
		}
	}

	// insert new block into unconfirmedPool
	for (let i = 0; i < unconfirmedPool.length; i++) {
		if (block.height >= unconfirmedBlock[i].block.height) {
			unconfirmedPool.splice(i, 0, { block, mempool: newMempool, utxo: newUtxos });
			break;
		}
	}

	// broadcast block to other nodes and clients.
};



const validateBlock = block => {
	return true;
};

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

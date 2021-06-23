import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Block from "../models/block.model.js";

const { createBlockchain, getHighestValidBlock } = BlockCrypto;

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
		return { block, status };
	});

	return blockchainInfo;
};

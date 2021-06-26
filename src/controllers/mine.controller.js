import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Block from "../models/block.model.js";
import Transaction from "../models/transaction.model.js";

const {
	createBlockchain,
	getTransactionFees,
	createOutput,
	calculateBlockReward,
	createTransaction,
	calculateTransactionHash,
	createBlock,
	calculateHashTarget,
	isBlockValidInBlockchain,
	addBlock,
	bigIntToHex64,
	RESULT,
} = BlockCrypto;

export const getMiningInfo = async () => {
	const blockchain = createBlockchain(await Block.find().populate("transactions"));
	const transactions = await Transaction.find();
};

export const createCandidateBlock = async (previousBlock, mempoolTxs, miner) => {
	const blockchain = createBlockchain(await Block.find().populate("transactions"));
	const transactions = await Transaction.find();
	const fees = mempoolTxs.reduce((total, tx) => total + getTransactionFees(transactions, tx), 0);
	const output = createOutput(miner, calculateBlockReward(params, previousBlock.height + 1) + fees);
	const coinbase = createTransaction(params, [], [output]);
	coinbase.hash = calculateTransactionHash(coinbase);
	const block = createBlock(params, blockchain, previousBlock, [coinbase, ...mempoolTxs]);
	const target = bigIntToHex64(calculateHashTarget(params, block));
	// validation
	const blockchainCopy = [...blockchain];
	addBlock(blockchainCopy, block);
	const validation = isBlockValidInBlockchain(params, blockchainCopy, block, true);
	return { block, target, validation };
};

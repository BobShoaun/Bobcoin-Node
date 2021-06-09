import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Block from "../models/block.model.js";
import Transaction from "../models/transaction.model.js";

const {
	mineGenesisBlock,
	createBlockchain,
	isBlockValidInBlockchain,
	isBlockchainValid,
	createTransaction,
	calculateTransactionHash,
	createOutput,
	RESULT,
	addBlock: addBlockToBlockchain,
} = BlockCrypto;

export async function mineGenesis(address) {
	const output = createOutput(address, params.initBlkReward);
	const coinbase = createTransaction(params, [], [output]);
	coinbase.hash = calculateTransactionHash(coinbase);
	const genesis = mineGenesisBlock(params, [coinbase]);

	await addBlock(genesis);
	return genesis;
}

export async function getBlockchain() {
	const blocks = await Block.find().populate("transactions");
	return createBlockchain(blocks);
}

export async function addBlock(block) {
	const blockchain = await getBlockchain();
	addBlockToBlockchain(blockchain, block);

	if (isBlockchainValid(params, blockchain, block).code !== RESULT.VALID)
		throw Error("invalid block");

	block.transactions = await Promise.all(
		block.transactions.map(
			async tx =>
				await Transaction.findOneAndUpdate({ hash: tx.hash }, tx, {
					upsert: true,
					new: true,
				})
		)
	);
	await new Block(block).save();
}

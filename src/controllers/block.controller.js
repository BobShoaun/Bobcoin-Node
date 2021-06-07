import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Block from "../models/block.model.js";
import Transaction from "../models/transaction.model.js";

const {
	mineGenesisBlock,
	createCoinbaseTransaction,
	createBlockchain,
	addBlockToBlockchain,
	isBlockValidInBlockchain,
	isBlockchainValid,
	RESULT,
} = BlockCrypto;

export async function mineGenesis(address) {
	const coinbase = createCoinbaseTransaction(params, [], null, [], address);
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
					returnNewDocument: true,
				})
		)
	);
	await new Block(block).save();
}

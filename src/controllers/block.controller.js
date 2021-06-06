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

	const genesisDB = new Block(genesis);
	const coinbaseDB = new Transaction(coinbase);
	await genesisDB.save();
	await coinbaseDB.save();

	return genesis;
}

export async function getBlockchain() {
	return createBlockchain(await Block.find());
}

export async function addBlock(block) {
	const blockchain = createBlockchain(await Block.find());

	addBlockToBlockchain(blockchain, block);

	if (isBlockchainValid(params, blockchain, block).code !== RESULT.VALID)
		throw Error("invalid block");

	const blockDB = new Block(block);
	await blockDB.save();
}

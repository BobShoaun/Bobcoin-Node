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
	const isBlockValid = isBlockValidInBlockchain(params, blockchain, block);
	if (!isBlockValid) throw new Error("Block is not valid!");

	addBlockToBlockchain(blockchain, block);
	const isChainValid = isBlockchainValid(params, blockchain);
	if (!isChainValid) throw new Error("Block compromises blockchain validity!");

	const blockDB = new Block(block);
	await blockDB.save();
}

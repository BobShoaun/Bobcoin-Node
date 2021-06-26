import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Block from "../models/block.model.js";
import Transaction from "../models/transaction.model.js";

const { createBlockchain, calculateMempoolUTXOSet, getHighestValidBlock } = BlockCrypto;

export const getUTXOs = async (address, blockHash) => {
	const blockchain = createBlockchain(await Block.find().populate("transactions"));
	const transactions = await Transaction.find();

	const headBlock = blockHash
		? await Block.findOne({ hash: blockHash })
		: getHighestValidBlock(params, blockchain);

	// get utxos from mempool
	const utxoSet = calculateMempoolUTXOSet(blockchain, headBlock, transactions).filter(
		utxo => utxo.address === address
	);

	return utxoSet;
};

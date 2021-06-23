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
	findTXO,
	bigIntToHex64,
	calculateBlockReward,
	calculateHashTarget,
	getBlockConfirmations,
} = BlockCrypto;

export const mineGenesis = async address => {
	const output = createOutput(address, params.initBlkReward);
	const coinbase = createTransaction(params, [], [output]);
	coinbase.hash = calculateTransactionHash(coinbase);
	const genesis = mineGenesisBlock(params, [coinbase]);

	await addBlock(genesis);
	return genesis;
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

export const getBlock = async hash => {
	const block = await Block.findOne({ hash: hash }).populate("transactions");
	if (!block) throw Error("cannot find block with hash: " + hash);
	return block;
};

export const getBlockInfo = async hash => {
	const block = await getBlock(hash);
	const blockchain = createBlockchain(await Block.find().populate("transactions"));
	const transactions = await Transaction.find();

	const totalInput = block.transactions
		.slice(1)
		.reduce(
			(total, tx) =>
				total + tx.inputs.reduce((inT, input) => inT + findTXO(input, transactions).amount, 0),
			0
		);

	const totalOutput = block.transactions
		.slice(1)
		.reduce((total, tx) => total + tx.outputs.reduce((outT, output) => outT + output.amount, 0), 0);

	const validation = isBlockValidInBlockchain(params, blockchain, block);
	const isValid = validation.code === RESULT.VALID;
	const fee = totalInput - totalOutput;
	const confirmations = getBlockConfirmations(params, blockchain, block);
	const hashTarget = bigIntToHex64(calculateHashTarget(params, block));
	const reward = calculateBlockReward(params, block.height);

	return { block, isValid, totalInput, totalOutput, fee, confirmations, hashTarget, reward };
};

export const addBlock = async block => {
	const blockchain = createBlockchain(await getBlockchain());
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
};

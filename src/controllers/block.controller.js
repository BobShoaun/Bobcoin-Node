import { OrphanedBlock, MatureBlock, TransactionInfo } from "../models/index.js";

// export const mineGenesis = async address => {
// 	const output = createOutput(address, params.initBlkReward);
// 	const coinbase = createTransaction(params, [], [output]);
// 	coinbase.hash = calculateTransactionHash(coinbase);
// 	const genesis = mineGenesisBlock(params, [coinbase]);

// 	await addBlock(genesis);
// 	return genesis;
// };

export const getBlock = async (locals, hash) => {
	let block = locals.unconfirmedBlocks.find(block => block.hash === hash);
	if (block) return { block, status: "unconfirmed" };
	block = await MatureBlock.findOne({ hash }, { _id: false });
	if (block) return { block, status: "confirmed" };
	block = await OrphanedBlock.findOne({ hash }, { _id: false });
	if (block) return { block, status: "orphaned" };
	throw Error("cannot find block with hash: " + hash);
};

export const getBlockInfo = async (locals, hash) => {
	const { block, status } = await getBlock(locals, hash);
	const txs = await TransactionInfo.find({ blockHash: hash }, { _id: false });
	const transactions = [...txs].sort(
		(a, b) =>
			block.transactions.findIndex(tx => tx.hash === a.hash) -
			block.transactions.findIndex(tx => tx.hash === b.hash)
	);

	return { block, transactions, status };
};

export const getBlockHeightInfo = async (locals, height) => {
	let block = locals.unconfirmedBlocks.find(block => block.height === height);
	let status = "unconfirmed";
	if (!block) {
		block = await MatureBlock.findOne({ height }, { _id: false });
		status = "confirmed";
	}
	if (!block) {
		block = await OrphanedBlock.findOne({ height }, { _id: false });
		status = "orphaned";
	}
	if (!block) throw Error("cannot find block with hash: " + hash);

	const txs = await TransactionInfo.find({ blockHash: block.hash }, { _id: false });
	const transactions = [...txs].sort(
		(a, b) =>
			block.transactions.findIndex(tx => tx.hash === a.hash) -
			block.transactions.findIndex(tx => tx.hash === b.hash)
	);

	return { block, transactions, status };
};

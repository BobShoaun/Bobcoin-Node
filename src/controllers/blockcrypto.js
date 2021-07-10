import BlockCrypto from "blockcrypto";

const {
	createBlockchain,
	getTransactionFees,
	createOutput,
	calculateBlockReward,
	createTransaction,
	calculateTransactionHash,
	calculateHashTarget,
	isBlockValidInBlockchain,
	addBlock,
	bigIntToHex64,
	calculateMerkleRoot,
	RESULT,
} = BlockCrypto;

const createBlock = (params, previousBlock, transactions) => {
	const block = {
		height: previousBlock.height + 1,
		previousHash: previousBlock.hash,
		transactions,
		timestamp: Date.now(),
		version: params.version,
		merkleRoot: calculateMerkleRoot(transactions.map(tx => tx.hash)),
		nonce: 0,
	};
	block.difficulty = calculateBlockDifficulty(params, blockchain, block);
	return block;
};

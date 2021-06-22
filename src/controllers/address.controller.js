import params from "../params.js";
import Transaction from "../models/transaction.model.js";
import Block from "../models/block.model.js";

import BlockCrypto from "blockcrypto";
const {
	getHighestValidBlock,
	isAddressValid,
	getAddressTxs,
	getTxBlock,
	findTXO,
	calculateUTXOSet,
	createBlockchain,
} = BlockCrypto;

export const getAddressInfo = async (address, blockHash) => {
	const transactions = await Transaction.find();
	const blockchain = createBlockchain(await Block.find().populate("transactions"));
	const block = blockHash
		? await Block.findOne({ hash: blockHash })
		: getHighestValidBlock(params, blockchain);

	const utxos = calculateUTXOSet(blockchain, block).filter(utxo => utxo.address === address);
	const balance = utxos.reduce((prev, curr) => prev + curr.amount, 0);

	const [receivedTxs, sentTxs] = getAddressTxs(blockchain, block, address);
	const totalReceived = receivedTxs.reduce(
		(total, curr) =>
			total +
			curr.outputs
				.filter(out => out.address === address)
				.reduce((outT, outC) => outT + outC.amount, 0),
		0
	);
	const totalSent = sentTxs.reduce(
		(total, curr) =>
			total +
			curr.inputs.reduce((inT, inC) => {
				const txo = findTXO(inC, transactions);
				return inT + (txo.address === address ? txo.amount : 0);
			}, 0),
		0
	);

	let isValid = false;
	try {
		isValid = isAddressValid(params, address);
	} catch {}

	return { address, isValid, utxos, receivedTxs, sentTxs, totalReceived, totalSent, balance };
};

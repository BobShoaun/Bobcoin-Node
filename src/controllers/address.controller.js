import params from "../params.js";
import Transaction from "../models/transaction.model.js";
import Block from "../models/block.model.js";

import BlockCrypto from "blockcrypto";
const {
	getHighestValidBlock,
	isAddressValid,
	getAddressTxs,
	findTXO,
	calculateUTXOSet,
	createBlockchain,
	isTransactionValid,
	RESULT,
	isCoinbaseTxValid,
	getBlockConfirmations,
} = BlockCrypto;

import { getTransaction } from "./transaction.controller.js";

const getTransactionInfo = async (blockchain, transactions, hash, blockHash) => {
	const transaction = await getTransaction(hash);

	const inputInfo = transaction.inputs.map(input => {
		const txo = findTXO(input, transactions);
		return { address: txo.address, amount: txo.amount };
	});
	const totalInput = inputInfo.reduce((total, info) => total + info.amount, 0);

	const totalOutput = transaction.outputs.reduce((total, output) => total + output.amount, 0);
	const fee = totalInput - totalOutput;
	const isCoinbase = transaction.inputs.length === 0 && transaction.outputs.length === 1;

	// TODO: find from best chain not entire blockchain, or not?
	const block =
		blockchain.find(block => block.hash === blockHash) ??
		blockchain.find(block => block.transactions.some(tx => tx.hash === hash));
	const confirmations = block ? getBlockConfirmations(params, blockchain, block) : 0;

	const validation = isCoinbase
		? isCoinbaseTxValid(params, transaction)
		: isTransactionValid(params, transactions, transaction);

	const isValid = validation.code === RESULT.VALID;

	const headBlock = getHighestValidBlock(params, blockchain);
	const utxos = calculateUTXOSet(blockchain, headBlock);

	const outputSpent = transaction.outputs.map(
		(output, index) =>
			!utxos.some(
				utxo =>
					utxo.address === output.address &&
					utxo.amount === output.amount &&
					utxo.txHash === transaction.hash &&
					utxo.outIndex === index
			)
	);

	return {
		transaction,
		isValid,
		validation,
		block,
		totalInput,
		totalOutput,
		fee,
		isCoinbase,
		confirmations,
		inputInfo,
		outputSpent,
	};
};

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

	const inboundTxs = await Promise.all(
		receivedTxs.map(async tx => await getTransactionInfo(blockchain, transactions, tx.hash))
	);

	const outboundTxs = await Promise.all(
		sentTxs.map(async tx => await getTransactionInfo(blockchain, transactions, tx.hash))
	);

	let isValid = false;
	try {
		isValid = isAddressValid(params, address);
	} catch {}

	return { address, isValid, utxos, inboundTxs, outboundTxs, totalReceived, totalSent, balance };
};

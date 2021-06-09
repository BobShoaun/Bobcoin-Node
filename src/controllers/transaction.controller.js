import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Transaction from "../models/transaction.model.js";

const { isTransactionValid, RESULT } = BlockCrypto;

export async function getTransactions() {
	return await Transaction.find();
}

export async function addTransaction(transaction) {
	const transactions = await getTransactions();
	if (isTransactionValid(params, transactions, transaction).code !== RESULT.VALID)
		throw Error("invalid transaction");

	await new Transaction(transaction).save();
}

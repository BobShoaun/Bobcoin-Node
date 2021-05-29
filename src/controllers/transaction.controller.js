import BlockCrypto from "blockcrypto";

import params from "../params.js";
import Block from "../models/block.model.js";
import Transaction from "../models/transaction.model.js";

export async function getTransactions() {
	return await Transaction.find();
}

export async function addTransaction(transaction) {
	const transactionDB = new Transaction(transaction);
	await transactionDB.save();
}

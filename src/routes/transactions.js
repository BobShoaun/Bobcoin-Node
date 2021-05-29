import Express from "express";
import Block from "../models/block.model.js";
import Transaction from "../models/transaction.model.js";

import BlockCrypto from "blockcrypto";
import params from "../params.js";

const { mineGenesisBlock, createCoinbaseTransaction, calculateBlockHash } = BlockCrypto;

export const transactionsRouter = io => {
	const router = Express.Router();

	function error(res, e) {
		res.status(400).json(`Error: ${e}`);
		console.error(e);
	}

	router.get("/", async (req, res) => {
		try {
			const transactions = await Transaction.find();
			res.send(transactions);
		} catch (e) {
			error(res, e);
		}
	});

	router.post("/", async (req, res) => {
		try {
			const transaction = req.body;
			const transactionDB = new Transaction(req.body);
			await transactionDB.save();
			res.send("transaction added!");
			io.sockets.emit("transaction", transaction);
		} catch (e) {
			error(res, e);
		}
	});

	return router;
};

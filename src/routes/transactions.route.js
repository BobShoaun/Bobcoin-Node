import Express from "express";
import { getTransactions, addTransaction } from "../controllers/transaction.controller.js";

export const transactionsRouter = io => {
	const router = Express.Router();

	function error(res, e) {
		res.status(400).json(`Error: ${e}`);
		console.error(e);
	}

	router.get("/", async (req, res) => {
		try {
			res.send(await getTransactions());
		} catch (e) {
			error(res, e);
		}
	});

	router.post("/", async (req, res) => {
		try {
			const transaction = req.body;
			addTransaction(transaction);
			io.sockets.emit("transaction", transaction);
			res.send("transaction added and broadcasted!");
		} catch (e) {
			error(res, e);
		}
	});

	return router;
};

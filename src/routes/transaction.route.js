import Express from "express";
import {
	getTransactions,
	addTransaction,
	getTransactionInfo,
	getMempoolInfo,
} from "../controllers/transaction.controller.js";

export const transactionRouter = io => {
	const router = Express.Router();

	function error(res, e) {
		res.status(400).json(`${e}`);
		console.error(e);
	}

	router.get("/", async (req, res) => {
		try {
			res.send(await getTransactions());
		} catch (e) {
			error(res, e);
		}
	});

	router.get("/info/:hash", async (req, res) => {
		try {
			const block = req.query.block;
			res.send(await getTransactionInfo(req.params.hash, block));
		} catch (e) {
			error(res, e);
		}
	});

	router.get("/mempool", (req, res) => {
		try {
			res.send(req.app.locals.mempool);
		} catch (e) {
			error(res, e);
		}
	});

	router.get("/mempool/info", (req, res) => {
		try {
			res.send(getMempoolInfo(req.app.locals));
		} catch (e) {
			error(res, e);
		}
	});

	router.post("/", (req, res) => {
		try {
			const transaction = req.body.transaction;
			const validation = addTransaction(req.app.locals, transaction);
			res.send(validation);
		} catch (e) {
			error(res, e);
		}
	});

	return router;
};

import Express from "express";

import { getBlockchain, getBlockchainNew } from "../controllers/blockchain.controller.js";

export const blockchainRouter = io => {
	const router = Express.Router();

	const error = (res, e) => {
		res.status(400).json(`${e}`);
		console.log(e);
	};

	router.get("/", async (req, res) => {
		try {
			const limit = parseInt(req.query.limit);
			const height = parseInt(req.query.height);
			const timestamp = parseInt(req.query.timestamp) || null;
			res.send(await getBlockchain(limit, height, timestamp));
		} catch (e) {
			error(res, e);
		}
	});

	router.get("/info", async (req, res) => {
		try {
			const limit = parseInt(req.query.limit);
			const height = parseInt(req.query.height);
			res.send(await getBlockchainNew(req.app.locals, limit, height));
		} catch (e) {
			error(res, e);
		}
	});

	router.get("/head", (req, res) => {
		res.send(req.app.locals.headBlock);
	});

	router.get("/unconfirmed", (req, res) => {
		res.send(req.app.locals.unconfirmedBlocks);
	});

	return router;
};

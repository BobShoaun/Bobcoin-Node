import Express from "express";

import {
	getBlockchain,
	getBlockchainInfo,
	getBestBlock,
} from "../controllers/blockchain.controller.js";

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
			const timestamp = parseInt(req.query.timestamp);
			res.send(await getBlockchainInfo(limit, height, timestamp));
		} catch (e) {
			error(res, e);
		}
	});

	router.get("/head_block", async (req, res) => {
		try {
			res.send(await getBestBlock());
		} catch (e) {
			error(res, e);
		}
	});

	return router;
};

import Express from "express";

import { getBlockchain, mineGenesis, addBlock, getBlock } from "../controllers/block.controller.js";

export const blocksRouter = io => {
	const router = Express.Router();

	function error(res, e) {
		res.status(400).json(`${e}`);
	}

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

	router.get("/:hash", async (req, res) => {
		try {
			res.send(await getBlock(req.params.hash));
		} catch (e) {
			error(res, e);
		}
	});

	router.post("/", async (req, res) => {
		try {
			const block = req.body;
			await addBlock(block);
			io.sockets.emit("block", block);
			res.send("block added and broadcasted");
		} catch (e) {
			error(res, e);
		}
	});

	router.post("/mine-genesis", async (req, res) => {
		try {
			const address = req.body.address;
			const genesis = await mineGenesis(address);
			io.sockets.emit("block", genesis);
			res.json(genesis);
		} catch (e) {
			error(res, e);
		}
	});

	return router;
};

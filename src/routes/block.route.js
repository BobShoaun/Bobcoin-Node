import Express from "express";

import { mineGenesis, getBlock, getBlockInfo } from "../controllers/block.controller.js";
import { addBlock } from "../controllers/blockchain.controller.js";

export const blocksRouter = io => {
	const router = Express.Router();

	function error(res, e) {
		res.status(400).json(`${e}`);
		console.log(e);
	}

	router.get("/:hash", async (req, res) => {
		try {
			res.send(await getBlock(req.app.locals, req.params.hash));
		} catch (e) {
			error(res, e);
		}
	});

	router.get("/info/:hash", async (req, res) => {
		try {
			res.send(await getBlockInfo(req.params.hash));
		} catch (e) {
			error(res, e);
		}
	});

	router.post("/", async (req, res) => {
		try {
			const block = req.body.block;
			res.send(await addBlock(req.app.locals, block, io));
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

import Express from "express";

import params from "../params.js";

import { createCandidateBlock } from "../controllers/mine.controller.js";

export const mineRouter = () => {
	const router = Express.Router();

	const error = (res, e) => {
		res.status(400).json(`${e}`);
		console.log(e);
	};

	router.post("/candidate_block", async (req, res) => {
		const previousBlock = req.body.previousBlock;
		const mempoolTxs = req.body.mempoolTxs;
		const miner = req.body.miner;
		try {
			res.send(await createCandidateBlock(previousBlock, mempoolTxs, miner));
		} catch (e) {
			error(res, e);
		}
	});

	return router;
};

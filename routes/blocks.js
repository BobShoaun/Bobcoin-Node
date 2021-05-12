import Express from "express";
import Block from "../models/block.model.js";

const router = Express.Router();

router.route("/").get(async (req, res) => {
	try {
		const blocks = await Block.find();
		res.send(blocks);
	} catch (e) {
		res.status(400).json(`Error: ${e}`);
		console.error(e);
	}
});

router.route("/").post(async (req, res) => {
	try {
		const newBlock = new Block(req.body);
		await newBlock.save();
		res.send("block added");
	} catch (e) {
		res.status(400).json(`Error: ${e}`);
		console.error(e);
	}
});

router.route("/mine-genesis").post(async (req, res) => {
	try {
		// const genesis =
	} catch (error) {
		res.status(400).json(`Error: ${error}`);
		console.error(error);
	}
});

export default router;

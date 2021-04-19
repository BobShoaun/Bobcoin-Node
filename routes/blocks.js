import Express from "express";
import Block from "../models/block.model.js";

const router = Express.Router();

router.route("/").get(async (req, res) => {
	try {
		let blocks = await Block.find();
		res.send(blocks);
	} catch (e) {
    res.status(400).json(`Error: ${e}`);
		console.error(e);
	}
});

router.route("/").post(async (req, res) => {
	const newBlock = new Block(req.body);
	try {
		await newBlock.save();
		res.send("block added");
	} catch (e) {
		res.status(400).json(`Error: ${e}`);
		console.error(e);
	}
});

export default router;
import Express from "express";
import Block from "../models/block.model.js";
import Transaction from "../models/transaction.model.js";

import BlockCrypto from "blockcrypto";
import params from "../params.js";

const { mineGenesisBlock, createCoinbaseTransaction } = BlockCrypto;

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
		const address = req.body.address;
		const coinbase = createCoinbaseTransaction(params, [], null, [], address);
		const genesis = mineGenesisBlock(params, [coinbase]);
		const genesisDB = new Block(genesis);
		const coinbaseDB = new Transaction(coinbase);
		await genesisDB.save();
		await coinbaseDB.save();
		console.log("genesis block mined: ", genesis);
		res.json(genesis);
	} catch (error) {
		res.status(400).json(`Error: ${error}`);
		console.error(error);
	}
});

export default router;

import Express from "express";
import Block from "../models/block.model.js";
import Transaction from "../models/transaction.model.js";

import BlockCrypto from "blockcrypto";
import params from "../params.js";

const { mineGenesisBlock, createCoinbaseTransaction, isBlockValidInBlockchain } = BlockCrypto;

export const blocksRouter = io => {
	const router = Express.Router();

	function error(res, e) {
		res.status(400).json(`Error: ${e}`);
		console.error(e);
	}

	router.get("/", async (req, res) => {
		try {
			const blocks = await Block.find();
			res.send(blocks);
		} catch (e) {
			error(res, e);
		}
	});

	router.post("/", async (req, res) => {
		try {
			const block = req.body;
			const blockDB = new Block(req.body);
			await blockDB.save();
			io.sockets.emit("block", block);
			res.send("block added");
		} catch (e) {
			error(res, e);
		}
	});

	router.post("/mine-genesis", async (req, res) => {
		try {
			const address = req.body.address;
			const coinbase = createCoinbaseTransaction(params, [], null, [], address);
			const genesis = mineGenesisBlock(params, [coinbase]);
			const genesisDB = new Block(genesis);
			const coinbaseDB = new Transaction(coinbase);
			await genesisDB.save();
			await coinbaseDB.save();
			console.log("genesis block mined: ", genesis, genesisDB);
			io.sockets.emit("block", genesis);
			res.json(genesis);
		} catch (error) {
			error(res, e);
		}
	});

	return router;
};

import Express from "express";
import { getUTXOs } from "../controllers/utxo.controller.js";

export const utxoRouter = () => {
	const router = Express.Router();

	router.get("/:address", (req, res) => {
		const block = req.query.block;
		const address = req.params.address;
		const utxos = getUTXOs(req.app.locals, address, block);
		res.send(utxos);
	});

	return router;
};

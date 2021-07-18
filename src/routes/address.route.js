import Express from "express";
import { getAddressInfo, getWalletInfo } from "../controllers/address.controller.js";

export const addressRouter = () => {
	const router = Express.Router();

	router.get("/:address", async (req, res) => {
		// const block = req.query.block;
		const address = req.params.address;
		const addressInfo = await getAddressInfo(req.app.locals, address);
		res.send(addressInfo);
	});

	router.post("/balance", async (req, res) => {
		const addresses = req.body.addresses;
		res.send(await getWalletInfo(req.app.locals, addresses));
	});

	return router;
};

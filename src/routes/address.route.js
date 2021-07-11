import Express from "express";
import { getAddressInfo } from "../controllers/address.controller.js";

export const addressRouter = () => {
	const router = Express.Router();

	router.get("/:address", async (req, res) => {
		// const block = req.query.block;
		const address = req.params.address;
		const addressInfo = await getAddressInfo(req.app.locals, address);
		res.send(addressInfo);
	});

	return router;
};

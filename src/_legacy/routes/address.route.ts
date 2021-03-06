import Express from "express";
import {
  getAddressInfo,
  getAddressesInfo,
  getAddressTransactions,
  getAddressesTransactions,
  getAddressUtxos,
  getAddressesUtxos,
} from "../controllers/address.controller";

export const addressRouter = () => {
  const router = Express.Router();

  router.get("/info/:address", async (req, res) => {
    const address = req.params.address;
    if (!address) return res.sendStatus(400);
    const addressInfo = await getAddressInfo(req.app.locals, address);
    res.send(addressInfo);
  });

  router.get("/transactions/:address", async (req, res) => {
    const address = req.params.address;
    const limit = parseInt(req.query.limit as string);
    const offset = parseInt(req.query.offset as string);
    if (!address) return res.sendStatus(400);

    const transactions = await getAddressTransactions(address, limit, offset);
    res.send(transactions);
  });

  router.get("/utxos/:address", async (req, res) => {
    const address = req.params.address;
    if (!address) return res.sendStatus(400);

    const utxos = await getAddressUtxos(req.app.locals, address);
    res.send(utxos);
  });

  router.post("/info", async (req, res) => {
    const addresses = req.body.addresses;
    const addressesInfo = await getAddressesInfo(req.app.locals, addresses);
    res.send(addressesInfo);
  });

  router.post("/transactions", async (req, res) => {
    const addresses = req.body.addresses;
    const limit = parseInt(req.query.limit as string);
    const offset = parseInt(req.query.offset as string);
    const transactions = await getAddressesTransactions(addresses, limit, offset);
    res.send(transactions);
  });

  router.post("/utxos", async (req, res) => {
    const addresses = req.body.addresses;
    const utxos = await getAddressesUtxos(req.app.locals, addresses);
    res.send(utxos);
  });

  return router;
};

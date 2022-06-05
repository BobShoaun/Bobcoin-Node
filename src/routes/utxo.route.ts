import { Router } from "express";
import { BlocksInfo, Utxos } from "../models";
import { getUtxosForAddress, getUtxos } from "../controllers/utxo.controller";

const router = Router();

router.get("/utxos", async (req, res) => {
  const utxos = await getUtxos();
  res.send(utxos);
});

router.get("/utxos/:address", async (req, res) => {
  const { address } = req.params;
  const utxos = await getUtxosForAddress(address);
  res.send(utxos);
});

export default router;

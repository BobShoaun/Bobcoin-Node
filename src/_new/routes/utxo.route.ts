import { Router } from "express";
import { BlocksInfo, Utxos } from "../models";

const router = Router();

router.get("/utxos", async (req, res) => {
  const utxos = await Utxos.find({}, { _id: false });
  res.send(utxos);
});

router.get("/utxo/:address", async (req, res) => {
  const { address } = req.params;
  const utxos = await Utxos.find({ address }, { _id: false });
  res.send(utxos);
});

export default router;

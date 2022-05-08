// @ts-nocheck
import { Router } from "express";
import { Block } from "../models";

const router = Router();

router.get("/utxos", async (req, res) => {
  res.send(req.app.locals.utxos);
});

router.get("/utxo/:address", async (req, res) => {
  const { address } = req.params;
  const utxos = req.app.locals.utxos.filter(utxo => utxo.address === address);
  res.send(utxos);
});

export default router;

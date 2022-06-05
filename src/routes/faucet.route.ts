import { Router } from "express";
import { isBefore, sub } from "date-fns";

import { getKeys, isAddressValid } from "blockcrypto";
import { FaucetEntries } from "../models";
import { getUtxosForAddress } from "../controllers/utxo.controller";
import { createSimpleTransaction, addTransaction } from "../controllers/transaction.controller";
import { getValidMempool } from "../controllers/mempool.controller";

import params from "../params";
import { VCODE } from "../helpers/validation-codes";

import {
  recaptchaSecretKey,
  faucetDonateAmount,
  faucetFeeAmount,
  faucetSecretKey,
  faucetCooldown,
} from "../config";
import axios from "axios";

const router = Router();

router.get("/faucet/info", async (req, res) => {
  const { address } = getKeys(params, faucetSecretKey);

  const utxos = await getUtxosForAddress(address);
  const balance = utxos.reduce((total, utxo) => total + utxo.amount, 0);

  res.send({ address, balance, donationAmount: faucetDonateAmount, cooldown: faucetCooldown });
});

router.post("/faucet/request", async (req, res) => {
  const { address, recaptchaResponse } = req.body;

  const { data } = await axios.post(
    `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaResponse}`
  );
  if (!data.success) return res.status(401).send("Invalid recaptcha");

  if (!isAddressValid(params, address)) return res.status(400).send("Invalid address");

  const { address: faucetAddress } = getKeys(params, faucetSecretKey);
  if (address === faucetAddress) return res.status(400).send("Cannot donate to faucet address");

  let faucetEntry = await FaucetEntries.findOne({ address });

  if (!faucetEntry) faucetEntry = new FaucetEntries({ address });
  else if (!isBefore(faucetEntry.updatedAt, sub(Date.now(), { hours: faucetCooldown })))
    // check if last request was 24 hours ago
    return res.status(403).send("Please wait for the cooldown period"); // too frequent

  // create transaction
  const transaction = await createSimpleTransaction(
    faucetSecretKey,
    address,
    faucetDonateAmount,
    faucetFeeAmount
  );

  try {
    const validation = await addTransaction(transaction);

    if (validation.code !== VCODE.VALID)
      return res.status(410).send("Insufficient funds in faucet"); // most likely not enough funds in faucet
  } catch (e) {
    return res.status(400).send(e);
  }

  faucetEntry.count++;
  await faucetEntry.save();

  req.app.locals.io.emit("transaction", { mempool: await getValidMempool() });

  //TODO: inform other nodes of new transaction

  res.status(201).send({ address: faucetEntry.address, count: faucetEntry.count });
});

export default router;

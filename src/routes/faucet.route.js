import Express from "express";
import { FaucetEntry } from "../models/index.js";
import { isBefore, sub } from "date-fns";

import params from "../params.js";
import BlockCrypto from "blockcrypto";
import { recaptchaSecretKey } from "../config.js";

import { getUtxosFactoringMempool } from "../helpers/utxo.helper.js";
import { getMempoolUtxos } from "../controllers/utxo.controller.js";
import { faucetDonateAmount, faucetFeeAmount, faucetSecretKey, faucetCooldown } from "../config.js";
import { addTransaction } from "../middlewares/transaction.middleware.js";
import axios from "axios";

const {
  isAddressValid,
  getKeys,
  createInput,
  createOutput,
  createTransaction,
  signTransaction,
  calculateTransactionHash,
  RESULT,
} = BlockCrypto;

const router = Express.Router();

// simple tx getting utxos excluding mempools, and change address is same as sender address
const createSimpleTransaction = (locals, senderSecretKey, recipientAddress, amount, fee) => {
  const { pk: senderPublicKey, address: senderAddress } = getKeys(params, senderSecretKey);

  // TODO: use new version in the future when blockchain reorg code is fixed
  // const utxos = getUtxosFactoringMempool(locals.utxos, locals.mempool, senderAddress);
  const utxos = getMempoolUtxos(locals, senderAddress);

  // pick utxos
  let inputAmount = 0;
  const inputs = [];
  for (const utxo of utxos) {
    inputAmount += utxo.amount;
    const input = createInput(utxo.txHash, utxo.outIndex, senderPublicKey);
    inputs.push(input);
    if (inputAmount >= amount) break;
  }

  const payment = createOutput(recipientAddress, amount);
  const outputs = [payment];

  const changeAmount = inputAmount - amount - fee;
  if (changeAmount > 0) {
    const change = createOutput(senderAddress, changeAmount);
    outputs.push(change);
  }

  const transaction = createTransaction(params, inputs, outputs);
  const signature = signTransaction(transaction, senderSecretKey);
  transaction.inputs.forEach(input => (input.signature = signature));
  transaction.hash = calculateTransactionHash(transaction);

  return transaction;
};

router.post(
  "/request",
  async (req, res, next) => {
    const { address, recaptchaResponse } = req.body;

    const { data } = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaResponse}`
    );
    // if (!data.success) return res.status(401).send("Invalid recaptcha");

    if (!isAddressValid(params, address)) return res.status(400).send("Invalid address");

    const { address: faucetAddress } = getKeys(params, faucetSecretKey);
    if (address === faucetAddress) return res.status(400).send("Cannot donate to faucet address");

    let faucetEntry = await FaucetEntry.findOne({ address });

    if (!faucetEntry) faucetEntry = new FaucetEntry({ address });
    else if (!isBefore(faucetEntry.updatedAt, sub(Date.now(), { seconds: 60 })))
      // check if last request was 24 hours ago
      return res.status(403).send("Please wait for the cooldown period"); // too frequent

    // create transaction
    const transaction = createSimpleTransaction(
      req.app.locals,
      faucetSecretKey,
      address,
      faucetDonateAmount,
      faucetFeeAmount
    );

    req.faucetEntry = faucetEntry;
    req.transaction = transaction;
    next();
  },
  addTransaction,
  async (req, res) => {
    if (req.validation.code !== RESULT.VALID)
      return res.status(410).send("Insufficient funds in faucet"); // most likely not enough funds in faucet

    req.faucetEntry.count++;
    await req.faucetEntry.save();
    res.status(201).send({ address: req.faucetEntry.address, count: req.faucetEntry.count });
  }
);

router.get("/info", (req, res) => {
  const { address } = getKeys(params, faucetSecretKey);

  const utxos = req.app.locals.utxos.filter(utxo => utxo.address === address);
  const balance = utxos.reduce((total, utxo) => total + utxo.amount, 0);

  res.send({ address, balance, donationAmount: faucetDonateAmount, cooldown: faucetCooldown });
});

export default router;

import Express from "express";
import { FaucetEntry } from "../models/index.js";
import { isBefore, sub } from "date-fns";

import params from "../params.js";
import BlockCrypto from "blockcrypto";

import { getMempoolUtxos } from "../controllers/utxo.controller.js";
import { faucetDonateAmount, faucetFeeAmount, faucetSecretKey } from "../config.js";

const {
  isAddressValid,
  getKeys,
  createInput,
  createOutput,
  createTransaction,
  signTransaction,
  calculateTransactionHash,
} = BlockCrypto;

const router = Express.Router();

// simple tx getting utxos excluding mempools, and change address is same as sender address
const createSimpleTransaction = (locals, senderSecretKey, recipientAddress, amount, fee) => {
  const { pk: senderPublicKey, address: senderAddress } = getKeys(params, senderSecretKey);

  const utxos = getMempoolUtxos(locals, senderAddress);
  console.log(senderAddress, utxos);
  utxos.sort((a, b) => a.amount - b.amount); // sort in ascending amounts, reduces utxo creation

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

router.post("/request/:address", async (req, res, next) => {
  const { address } = req.params;

  if (!isAddressValid(params, address)) return res.sendStatus(400);

  try {
    let faucetEntry = await FaucetEntry.findOne({ address });

    if (!faucetEntry) faucetEntry = new FaucetEntry({ address });
    else if (!isBefore(faucetEntry.updatedAt, sub(Date.now(), { seconds: 10 })))
      // check if last request was 24 hours ago
      return res.sendStatus(403); // too frequent

    // create transaction
    const transaction = createSimpleTransaction(
      req.app.locals,
      faucetSecretKey,
      address,
      faucetDonateAmount,
      faucetFeeAmount
    );
    console.log(transaction);

    faucetEntry.count++;
    await faucetEntry.save();

    return res.status(201).send({ address, count: faucetEntry.count });
  } catch (e) {
    console.log(e);
    return res.sendStatus(500);
  }
});

export default router;

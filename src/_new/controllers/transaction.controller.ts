import { Mempool, Utxos } from "../models";
import { mapVCode, VCODE } from "../helpers/validation-codes";
import {
  calculateTransactionHash,
  getAddressFromPKHex,
  calculateTransactionPreImage,
  isAddressValid,
  isSignatureValid,
} from "blockcrypto";
import params from "../params";

import { Transaction } from "../models/types";

export const addTransaction = async (transaction: Transaction) => {
  const validation = await validateTransaction(transaction);
  if (validation.code !== VCODE.VALID) throw validation;

  await Mempool.create(transaction);
  return validation;
};

// for non coinbase txs, or mempool transaction
export const validateTransaction = async (transaction: Transaction) => {
  if (!transaction.inputs.length) return mapVCode(VCODE.TX00);
  if (!transaction.outputs.length) return mapVCode(VCODE.TX01);
  if (!transaction.timestamp) return mapVCode(VCODE.TX02);
  if (!transaction.version) return mapVCode(VCODE.TX03);
  if (transaction.hash !== calculateTransactionHash(transaction)) return mapVCode(VCODE.TX04); // hash is invalid

  const preImage = calculateTransactionPreImage(transaction);

  let totalInput = 0;
  for (const input of transaction.inputs) {
    const utxo = await Utxos.findOne({ txHash: input.txHash, outIndex: input.outIndex });
    if (!utxo) return mapVCode(VCODE.TX05, input.txHash, input.outIndex);
    if (utxo.address !== getAddressFromPKHex(params, input.publicKey)) return mapVCode(VCODE.TX06);
    if (!isSignatureValid(input.signature, input.publicKey, preImage)) return mapVCode(VCODE.TX07); // signature not valid
    totalInput += utxo.amount;
  }

  let totalOutput = 0;
  for (const output of transaction.outputs) {
    if (!isAddressValid(params, output.address)) return mapVCode(VCODE.TX08);
    if (output.amount <= 0) return mapVCode(VCODE.TX09); // output amount invalid
    totalOutput += output.amount;
  }

  if (totalInput < totalOutput) return mapVCode(VCODE.TX10, totalInput, totalOutput);
  return mapVCode(VCODE.VALID); // valid!
};

// @ts-nocheck
import params from "../params";
import {
  calculateBlockReward,
  calculateTransactionHash,
  calculateHashTarget,
  calculateMerkleRoot,
  calculateBlockHash,
  getAddressFromPKHex,
  calculateTransactionPreImage,
  isAddressValid,
  result,
  RESULT,
  isSignatureValid,
  hexToBigInt,
} from "blockcrypto";

import { Blocks, BlocksInfo, Utxos, Mempool } from "../models";
import { mapVCode, VCODE } from "./validation-codes";

export const validateBlock = async block => {
  if (await Blocks.exists({ hash: block.hash })) return mapVCode(VCODE.BC04); // already in collection
  const previousBlock = await Blocks.findOne({ hash: block.previousHash });
  if (!previousBlock) return mapVCode(VCODE.BC01); // prev block not found, TODO: this is not really an error, should prompt node to search for previous block first.
  if (block.timestamp < previousBlock.timestamp) return mapVCode(VCODE.BC02);
  if (block.height !== previousBlock.height + 1) return mapVCode(VCODE.BC05); // height invalid

  if (!block.timestamp) return mapVCode(VCODE.BK01);
  if (!block.version) return mapVCode(VCODE.BK02);
  if (!block.transactions.length) return mapVCode(VCODE.BK03); // must have at least 1 tx (coinbase)
  if (block.hash !== calculateBlockHash(block)) return mapVCode(VCODE.BK05); // "invalid block hash";
  if (block.merkleRoot !== calculateMerkleRoot(block.transactions.map(tx => tx.hash)))
    return mapVCode(VCODE.BK06); // "invalid merkle root"

  const offset = block.height % params.diffRecalcHeight;

  if (block.difficulty !== locals.difficulty) return result(RESULT.BK04); // invalid difficulty

  const hashTarget = calculateHashTarget(params, block);
  const blockHash = hexToBigInt(block.hash);
  if (blockHash > hashTarget) return result(RESULT.BK05, [hashTarget]); // block hash not within target

  const utxos = [...locals.utxos];
  let blkTotalInput = 0;
  let blkTotalOutput = 0;

  // ----- transactions -----

  for (let i = 1; i < block.transactions.length; i++) {
    const transaction = block.transactions[i];
    if (!transaction.inputs.length || !transaction.outputs.length) return result(RESULT.TX00);
    if (!transaction.version || !transaction.timestamp) return result(RESULT.TX02);
    if (transaction.hash !== calculateTransactionHash(transaction)) return result(RESULT.TX01); // hash is invalid

    const preImage = calculateTransactionPreImage(transaction);

    let txTotalInput = 0;
    for (const input of transaction.inputs) {
      const utxoIdx = utxos.findIndex(
        utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
      );
      if (utxoIdx < 0) return result(RESULT.TX03, [input.txHash, input.outIndex]);

      if (utxos[utxoIdx].address !== getAddressFromPKHex(params, input.publicKey))
        return result(RESULT.TX04);

      if (!isSignatureValid(input.signature, input.publicKey, preImage)) return result(RESULT.TX08); // signature not valid

      txTotalInput += utxos[utxoIdx].amount;

      // remove input from utxos
      utxos.splice(utxoIdx, 1);
    }

    let txTotalOutput = 0;
    for (let j = 0; j < transaction.outputs.length; j++) {
      if (!isAddressValid(params, transaction.outputs[j].address)) return result(RESULT.TX05);
      if (transaction.outputs[j].amount <= 0) return result(RESULT.TX09); // output amount invalid

      txTotalOutput += transaction.outputs[j].amount;

      // add output to utxos
      utxos.push({
        txHash: transaction.hash,
        outIndex: j,
        address: transaction.outputs[j].address,
        amount: transaction.outputs[j].amount,
      });
    }

    if (txTotalInput < txTotalOutput) return result(RESULT.TX06, [txTotalInput, txTotalOutput]);

    blkTotalInput += txTotalInput;
    blkTotalOutput += txTotalOutput;
  }

  // ----- end transactions -----

  // ---- coinbase transaction ----
  const coinbaseTx = block.transactions[0];
  if (!coinbaseTx.version || !coinbaseTx.timestamp) return result(RESULT.CB01);
  if (coinbaseTx.inputs.length) return result(RESULT.CB02); // coinbase must not have inputs
  if (coinbaseTx.outputs.length !== 1) return result(RESULT.CB03); // wrong output length
  if (coinbaseTx.hash !== calculateTransactionHash(coinbaseTx)) return result(RESULT.CB00); // hash is invalid
  if (!isAddressValid(params, coinbaseTx.outputs[0].address)) return result(RESULT.CB04); // miner address invalid

  const coinbaseAmt = coinbaseTx.outputs[0].amount;
  if (!coinbaseAmt) return result(RESULT.CB06); // output amount invalid
  const fee = blkTotalInput - blkTotalOutput;
  const blockReward = calculateBlockReward(params, block.height);
  if (coinbaseAmt > fee + blockReward) return result(RESULT.CB05, [coinbaseAmt, fee + blockReward]); // coinbase amt larger than allowed

  // ---- end coinbase tx ----

  return result(RESULT.VALID);
};

export const validateCandidateBlock = block => {};

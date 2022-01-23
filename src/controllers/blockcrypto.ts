import BlockCrypto from "blockcrypto";
import { getMempoolUtxos } from "../helpers/utxo.helper";

import params from "../params";

const {
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
} = BlockCrypto;

export const validateBlock = (locals, block) => {
  if (locals.unconfirmedBlocks.find(b => b.hash === block.hash)) return result(RESULT.BC04); // block already in unconfirmed pool

  const previousBlock = locals.unconfirmedBlocks.find(b => b.hash === block.previousHash);
  if (!previousBlock) return result(RESULT.BC03); // prev blk not within unconfirmed

  if (block.height !== previousBlock.height + 1) return result(RESULT.BC00); // height invalid
  if (block.timestamp < previousBlock.timestamp) return result(RESULT.BC01); // timestamp smaller

  if (!block.version) return result(RESULT.BK01);
  if (!block.transactions.length) return result(RESULT.BK02); // must have at least 1 tx (coinbase)
  if (block.hash !== calculateBlockHash(block)) return result(RESULT.BK03); // block hash invalid
  if (block.difficulty !== locals.difficulty) return result(RESULT.BK04);
  if (block.merkleRoot !== calculateMerkleRoot(block.transactions.map(tx => tx.hash)))
    return result(RESULT.BK06);

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

// for non coinbase txs, or mempool transaction
export const validatedTransaction = (locals, transaction) => {
  if (!transaction.inputs.length || !transaction.outputs.length) return result(RESULT.TX00);
  if (!transaction.version || !transaction.timestamp) return result(RESULT.TX02);
  if (transaction.hash !== calculateTransactionHash(transaction)) return result(RESULT.TX01); // hash is invalid

  const preImage = calculateTransactionPreImage(transaction);

  let totalInput = 0;
  for (const input of transaction.inputs) {
    const mempoolUtxos = getMempoolUtxos(locals.mempool);
    const utxo = [...locals.utxos, ...mempoolUtxos].find(
      utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
    );
    if (!utxo) return result(RESULT.TX03, [input.txHash, input.outIndex]);
    if (utxo.address !== getAddressFromPKHex(params, input.publicKey)) return result(RESULT.TX04);
    if (!isSignatureValid(input.signature, input.publicKey, preImage)) return result(RESULT.TX08); // signature not valid

    totalInput += utxo.amount;
  }

  let totalOutput = 0;
  for (const output of transaction.outputs) {
    if (!isAddressValid(params, output.address)) return result(RESULT.TX05);
    if (output.amount <= 0) return result(RESULT.TX09); // output amount invalid

    totalOutput += output.amount;
  }

  if (totalInput < totalOutput) return result(RESULT.TX06, [totalInput, totalOutput]);

  return result(RESULT.VALID);
};

export const validateCandidateBlock = (locals, block) => {
  if (locals.unconfirmedBlocks.find(b => b.hash === block.hash)) return result(RESULT.BC04); // block already in unconfirmed pool

  const previousBlock = locals.unconfirmedBlocks.find(b => b.hash === block.previousHash);
  if (!previousBlock) return result(RESULT.BC03); // prev blk not within unconfirmed

  if (block.height !== previousBlock.height + 1) return result(RESULT.BC00); // height invalid
  if (block.timestamp < previousBlock.timestamp) return result(RESULT.BC01); // timestamp smaller

  if (!block.version) return result(RESULT.BK01);
  if (!block.transactions.length) return result(RESULT.BK02); // must have at least 1 tx (coinbase)
  if (block.difficulty !== locals.difficulty) return result(RESULT.BK04);
  if (block.merkleRoot !== calculateMerkleRoot(block.transactions.map(tx => tx.hash)))
    return result(RESULT.BK06);

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

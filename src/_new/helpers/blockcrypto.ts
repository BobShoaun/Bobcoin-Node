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
import { Block } from "../models/types";

// calculate difficulty for current block
export const calculateDifficulty = async (height: number, previousHash: string) => {
  const offset = (height - 1) % params.diffRecalcHeight;
  const currRecalcHeight = height - 1 - offset;
  const prevRecalcHeight = currRecalcHeight - params.diffRecalcHeight;

  let currRecalcBlock: Block = {
    previousHash,
    height: -1,
    hash: "",
    timestamp: 0,
    version: "",
    difficulty: 0,
    nonce: 0,
    merkleRoot: "",
    transactions: [],
  };
  do currRecalcBlock = await Blocks.findOne({ hash: currRecalcBlock.previousHash }).lean();
  while (currRecalcBlock.height !== currRecalcHeight);

  let prevRecalcBlock = currRecalcBlock;
  do prevRecalcBlock = await Blocks.findOne({ hash: prevRecalcBlock.previousHash }).lean();
  while (prevRecalcBlock.height !== prevRecalcHeight);

  const timeDiff = (currRecalcBlock.timestamp - prevRecalcBlock.timestamp) / 1000; // divide to get seconds
  const targetTimeDiff = params.diffRecalcHeight * params.targBlkTime; // in seconds
  let correctionFactor = targetTimeDiff / timeDiff;
  correctionFactor = Math.min(correctionFactor, params.maxDiffCorrFact); // clamp correctionfactor
  correctionFactor = Math.max(correctionFactor, params.minDiffCorrFact);
  return (
    Math.round(
      (Math.max(currRecalcBlock.difficulty * correctionFactor, params.initBlkDiff) +
        Number.EPSILON) *
        10000
    ) / 10000
  ); // new difficulty, max 4 decimal places
};

// validate without hash
export const validateCandidateBlock = async (block: Block) => {
  if (await Blocks.exists({ hash: block.hash })) return mapVCode(VCODE.BC04); // already in collection
  const previousBlock = await Blocks.findOne({ hash: block.previousHash });
  if (!previousBlock) return mapVCode(VCODE.BC01); // prev block not found, TODO: this is not really an error, should prompt node to search for previous block first.
  if (block.timestamp < previousBlock.timestamp) return mapVCode(VCODE.BC02);
  if (block.height !== previousBlock.height + 1) return mapVCode(VCODE.BC05); // height invalid

  if (!block.timestamp) return mapVCode(VCODE.BK01);
  if (!block.version) return mapVCode(VCODE.BK02);
  if (!block.transactions.length) return mapVCode(VCODE.BK03); // must have at least 1 tx (coinbase)
  if (block.merkleRoot !== calculateMerkleRoot(block.transactions.map(tx => tx.hash)))
    return mapVCode(VCODE.BK06); // "invalid merkle root"

  const difficulty = await calculateDifficulty(block.height, block.previousHash);
  if (block.difficulty !== difficulty) return mapVCode(VCODE.BK04, difficulty, block.difficulty); // invalid difficulty

  let blkTotalInput = 0;
  let blkTotalOutput = 0;

  // ----- transactions -----
  for (let i = 1; i < block.transactions.length; i++) {
    const transaction = block.transactions[i];
    if (!transaction.inputs.length) return mapVCode(VCODE.TX00);
    if (!transaction.outputs.length) return mapVCode(VCODE.TX01);
    if (!transaction.timestamp) return mapVCode(VCODE.TX02);
    if (!transaction.version) return mapVCode(VCODE.TX03);
    if (transaction.hash !== calculateTransactionHash(transaction)) return mapVCode(VCODE.TX04); // hash is invalid

    const preImage = calculateTransactionPreImage(transaction);

    let txTotalInput = 0;
    for (const input of transaction.inputs) {
      // find utxo
      let utxo = null;
      let prevBlock = block;
      outer: while (prevBlock) {
        prevBlock = (await Blocks.findOne({ hash: prevBlock.previousHash }).lean()) as Block;
        if (!prevBlock) return mapVCode(VCODE.TX05, input.txHash, input.outIndex); // utxo not found, got to genesis block
        for (const tx of prevBlock.transactions) {
          for (const _input of tx.inputs) {
            if (_input.txHash === input.txHash && _input.outIndex === input.outIndex)
              return mapVCode(VCODE.TX11, input.txHash, input.outIndex); // utxo is stxo (spent)
          }
          if (tx.hash === input.txHash) {
            utxo = tx.outputs[input.outIndex];
            break outer;
          }
        }
      }

      if (utxo.address !== getAddressFromPKHex(params, input.publicKey))
        return mapVCode(VCODE.TX06);
      if (!isSignatureValid(input.signature, input.publicKey, preImage))
        return mapVCode(VCODE.TX07); // signature not valid

      txTotalInput += utxo.amount;
    }

    let txTotalOutput = 0;
    for (let j = 0; j < transaction.outputs.length; j++) {
      const address = transaction.outputs[j].address;
      const amount = transaction.outputs[j].amount;
      if (!isAddressValid(params, address)) return mapVCode(VCODE.TX08);
      if (amount <= 0) return mapVCode(VCODE.TX09); // output amount invalid

      txTotalOutput += amount;
    }

    if (txTotalInput < txTotalOutput) return mapVCode(VCODE.TX10, txTotalInput, txTotalOutput);

    blkTotalInput += txTotalInput;
    blkTotalOutput += txTotalOutput;
  }
  // ----- end transactions -----

  // ---- coinbase transaction ----
  const coinbaseTx = block.transactions[0];
  if (!coinbaseTx.timestamp) return mapVCode(VCODE.CB00);
  if (!coinbaseTx.version) return mapVCode(VCODE.CB01);
  if (coinbaseTx.inputs.length) return mapVCode(VCODE.CB02); // coinbase must not have inputs
  if (coinbaseTx.outputs.length !== 1) return mapVCode(VCODE.CB03); // wrong output length
  if (coinbaseTx.hash !== calculateTransactionHash(coinbaseTx)) return mapVCode(VCODE.CB04); // hash is invalid
  if (!isAddressValid(params, coinbaseTx.outputs[0].address)) return mapVCode(VCODE.CB05); // miner address invalid

  const coinbaseAmt = coinbaseTx.outputs[0].amount;
  if (!coinbaseAmt) return mapVCode(VCODE.CB06); // output amount invalid
  const fee = blkTotalInput - blkTotalOutput;
  const blockReward = calculateBlockReward(params, block.height);
  if (coinbaseAmt !== fee + blockReward)
    return mapVCode(VCODE.CB07, fee + blockReward, coinbaseAmt); // coinbase amt larger than allowed
  // ---- end coinbase tx ----

  return mapVCode(VCODE.VALID); // valid!
};

export const validateBlock = async (block: Block) => {
  const result = await validateCandidateBlock(block);

  if (block.hash !== calculateBlockHash(block)) return mapVCode(VCODE.BK05); // "invalid block hash";
  const hashTarget = calculateHashTarget(params, block);
  const blockHash = hexToBigInt(block.hash);
  if (blockHash > hashTarget) return mapVCode(VCODE.BK07, hashTarget); // block hash not within target

  return result;
};

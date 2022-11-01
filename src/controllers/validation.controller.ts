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
  isSignatureValid,
  hexToBigInt,
} from "blockcrypto";

import { Blocks } from "../models";
import { mapVCode, VCODE } from "../helpers/validation-codes";
import { Block, Utxo } from "../models/types";
import { calculateDifficulty } from "./blockchain.controller";

// validate without hash
export const validateCandidateBlock = async (block: Block) => {
  if (await Blocks.exists({ hash: block.hash })) return mapVCode(VCODE.BC04); // already in blockchain
  const previousBlock = await Blocks.findOne({ hash: block.previousHash });
  if (!previousBlock) return mapVCode(VCODE.BC01); // prev block not found, TODO: this is not really an error, should prompt node to search for previous block first.
  if (block.timestamp < previousBlock.timestamp) return mapVCode(VCODE.BC02);
  if (block.height !== previousBlock.height + 1) return mapVCode(VCODE.BC05); // height invalid

  if (!block.timestamp) return mapVCode(VCODE.BK01);
  if (!block.version) return mapVCode(VCODE.BK02);
  if (!block.transactions.length) return mapVCode(VCODE.BK03); // must have at least 1 tx (coinbase)
  if (block.merkleRoot !== calculateMerkleRoot(block.transactions.map(tx => tx.hash)))
    return mapVCode(VCODE.BK06); // "invalid merkle root"

  const difficulty = await calculateDifficulty(previousBlock);
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
      let utxo = null; // find utxo

      // check own block first
      for (const transaction of block.transactions.slice(0, i).reverse()) {
        if (
          transaction.inputs.some(
            _input => _input.txHash === input.txHash && _input.outIndex === input.outIndex
          )
        )
          return mapVCode(VCODE.TX11, input.txHash, input.outIndex); // utxo is stxo (spent)
        if (input.txHash === transaction.hash) {
          utxo = transaction.outputs[input.outIndex];
          break;
        }
      }

      if (!utxo) {
        let prevBlockHash = block.previousHash;
        // @ts-ignore
        outer: for await (const prevBlock of Blocks.find(
          { height: { $lt: block.height } },
          { _id: 0 }
        )
          .sort({ height: -1 })
          .lean() as Block[]) {
          if (prevBlockHash !== prevBlock.hash) continue; // wrong branch
          for (const transaction of [...prevBlock.transactions].reverse()) {
            if (
              transaction.inputs.some(
                _input => _input.txHash === input.txHash && _input.outIndex === input.outIndex
              )
            )
              return mapVCode(VCODE.TX11, input.txHash, input.outIndex); // utxo is stxo (spent)
            if (input.txHash === transaction.hash) {
              utxo = transaction.outputs[input.outIndex];
              break outer;
            }
          }
          prevBlockHash = prevBlock.previousHash;
        }
      }

      if (!utxo) return mapVCode(VCODE.TX05, input.txHash, input.outIndex); // utxo not found, got to genesis block

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

// blocks doesnt have to be sorted.
// TODO: optimize with async iters
export const validateBlockchain = (blocks: Block[]) => {
  const blocksPerHeight: Block[][] = []; // array of array
  for (const block of blocks) {
    if (blocksPerHeight[block.height]) {
      blocksPerHeight[block.height].push(block);
      continue;
    }
    blocksPerHeight[block.height] = [block];
  }

  if (blocksPerHeight[0].length !== 1) return mapVCode(VCODE.BC00);

  let totalValidatedBlocks = 0;

  const branches: [{ block: any; utxos: Utxo[]; difficulty: number }] = [
    { block: blocksPerHeight[0][0], utxos: [], difficulty: params.initBlkDiff },
  ];

  while (branches.length) {
    totalValidatedBlocks++;
    const { block, utxos, difficulty } = branches.shift();

    if (block.height > 0) {
      // not genesis block
      if (!block.previousHash) return mapVCode(VCODE.BK00);
      const prevBlock = blocksPerHeight[block.height - 1].find(b => b.hash === block.previousHash);
      if (!prevBlock) return mapVCode(VCODE.BC01); // prev block not found due to invalid height or invalid previousHash
      if (block.timestamp < prevBlock.timestamp) return mapVCode(VCODE.BC02);
    }

    if (!block.timestamp) return mapVCode(VCODE.BK01);
    if (!block.version) return mapVCode(VCODE.BK02);
    if (!block.transactions.length) return mapVCode(VCODE.BK03);

    if (block.version === "1.2.0" && block.difficulty !== difficulty)
      // account for diff recalc bug before version update
      return mapVCode(VCODE.BK04, difficulty, block.difficulty);

    if (block.version === "1.2.0" || block.version === "0.1.0")
      block.difficulty = block.difficulty.toFixed(4); // account for error/bug when calculating hash with difficulty as string.

    if (block.hash !== calculateBlockHash(block)) {
      console.log("invalid block", block);
      return mapVCode(VCODE.BK05); // "invalid block hash";
    }
    if (block.merkleRoot !== calculateMerkleRoot(block.transactions.map(tx => tx.hash)))
      return mapVCode(VCODE.BK06); // "invalid merkle root"

    const hashTarget = calculateHashTarget(params, block);
    const blockHash = hexToBigInt(block.hash);
    if (blockHash > hashTarget) return mapVCode(VCODE.BK07, hashTarget); // block hash not within target

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
        const utxoIdx = utxos.findIndex(
          utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
        );
        if (utxoIdx < 0) return mapVCode(VCODE.TX05, input.txHash, input.outIndex); // utxo not found
        if (utxos[utxoIdx].address !== getAddressFromPKHex(params, input.publicKey))
          return mapVCode(VCODE.TX06);
        if (!isSignatureValid(input.signature, input.publicKey, preImage))
          return mapVCode(VCODE.TX07); // signature not valid

        txTotalInput += utxos[utxoIdx].amount;

        // remove input from utxos
        utxos.splice(utxoIdx, 1);
      }

      let txTotalOutput = 0;
      for (let j = 0; j < transaction.outputs.length; j++) {
        const address = transaction.outputs[j].address;
        const amount = transaction.outputs[j].amount;
        if (!isAddressValid(params, address)) return mapVCode(VCODE.TX08);
        if (amount <= 0) return mapVCode(VCODE.TX09); // output amount invalid

        txTotalOutput += amount;
        utxos.push({ txHash: transaction.hash, outIndex: j, address, amount }); // add output to utxos
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
    // add output to utxos
    utxos.push({
      txHash: coinbaseTx.hash,
      outIndex: 0,
      address: coinbaseTx.outputs[0].address,
      amount: coinbaseAmt,
    });
    // ---- end coinbase tx ----

    const nextBlocks =
      blocksPerHeight[block.height + 1]?.filter(b => b.previousHash === block.hash) ?? [];

    // ----- calculate difficulty -----
    const newDifficulty = (() => {
      if (block.height > 0 && block.height % params.diffRecalcHeight === 0) {
        // get block diffRecalcHeights ago
        let prevRecalcBlock = block;
        do {
          prevRecalcBlock = blocksPerHeight[prevRecalcBlock.height - 1].find(
            b => b.hash === prevRecalcBlock.previousHash
          );
        } while (prevRecalcBlock.height !== block.height - params.diffRecalcHeight);

        const timeDiff = (block.timestamp - prevRecalcBlock.timestamp) / 1000; // divide to get seconds
        const targetTimeDiff = params.diffRecalcHeight * params.targBlkTime; // in seconds
        let correctionFactor = targetTimeDiff / timeDiff;
        correctionFactor = Math.min(correctionFactor, params.maxDiffCorrFact); // clamp correctionfactor
        correctionFactor = Math.max(correctionFactor, params.minDiffCorrFact);

        return (
          Math.round(
            (Math.max(difficulty * correctionFactor, params.initBlkDiff) + Number.EPSILON) * 10000
          ) / 10000
        ); // new difficulty, max 4 decimal places
      }
      return difficulty;
    })();
    // ----- end calculate difficulty -----

    for (const nextBlock of nextBlocks)
      branches.push({ block: nextBlock, utxos: [...utxos], difficulty: newDifficulty });
  }

  if (totalValidatedBlocks !== blocks.length) return mapVCode(VCODE.BC03); // blocks without any parent.

  return mapVCode(VCODE.VALID); // all good!
};

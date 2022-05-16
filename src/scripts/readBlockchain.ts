// @ts-nocheck
import BlockCrypto from "blockcrypto";
import fs from "fs";
import mongoose from "mongoose";
import { atlasURI, network } from "../config";
import { Blocks, Mempool } from "../_new/models/index";
import { testnetParams, mainnetParams } from "../params";
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

import { VCODE, mapVCode } from "../_new/helpers/validation-codes.ts";

const params = testnetParams;

const filePath = process.argv[2] ?? "./output.json";
const { blocks, mempool } = JSON.parse(fs.readFileSync(filePath));

// blocks.sort((a, b) => a.height - b.height).reverse();

// blocks doesnt have to be sorted.
const validateBlockchain = blocks => {
  const blocksPerHeight = []; // array of array
  for (const block of blocks) {
    if (blocksPerHeight[block.height]) {
      blocksPerHeight[block.height] = [...blocksPerHeight[block.height], block];
      continue;
    }
    blocksPerHeight[block.height] = [block];
  }

  if (blocksPerHeight[0].length !== 1) return mapVCode(VCODE.BC00);

  let totalValidatedBlocks = 0;

  // block cannot be genesis
  const validateBlock = (block, utxos = [], difficulty = params.initBlkDiff) => {
    totalValidatedBlocks++;

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

    if (block.hash !== calculateBlockHash(block)) return mapVCode(VCODE.BK05); // "invalid block hash";
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
    if (!nextBlocks.length) return mapVCode(VCODE.VALID); // reached deadend

    // ----- calculate difficulty -----
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

      difficulty =
        Math.round(
          (Math.max(difficulty * correctionFactor, params.initBlkDiff) + Number.EPSILON) * 10000
        ) / 10000; // new difficulty, max 4 decimal places

      // console.log("new diff", difficulty);
    }
    // ----- end calculate difficulty -----

    for (const nextBlock of nextBlocks) {
      const validation = validateBlock(nextBlock, [...utxos], difficulty);
      if (validation.code !== VCODE.VALID) return validation;
    }
    return mapVCode(VCODE.VALID);
  };

  const validation = validateBlock(blocksPerHeight[0][0]);
  if (validation.code !== VCODE.VALID) return validation;
  if (totalValidatedBlocks !== blocks.length) return mapVCode(VCODE.BC03); // blocks without any parent.

  return mapVCode(VCODE.VALID); // all good!
};

console.log(
  validateBlockchain(blocks).code === VCODE.VALID
    ? "Blockchain is valid"
    : "Blockchain is invalid!!!"
);

// for (let i = 0; i < blocks.length; i++) {
//   if (blocks[i].version === "1.2.0" || blocks[i].version === "0.1.0") {
//     blocks[i].difficulty = blocks[i].difficulty.toFixed(4);
//   }
//   const actualHash = calculateBlockHash(blocks[i]);
//   if (blocks[i].hash !== actualHash) {
//     console.log("mismatch:", blocks[i].height, blocks[i].version, blocks[i].hash, actualHash);
//   } else {
//     // console.log(blocks[i].height, blocks[i].version);
//   }
// }

// // find headblock as earlist highest block
// const highest = blocks[0].height; // highest block is first
// let headBlock = blocks[0];
// for (const block of blocks) {
//   if (block.height !== highest) break;
//   if (headBlock.timestamp > block.timestamp) headBlock = block;
// }
// console.log("headblock height: ", headBlock.height);

// let currHash = headBlock.hash;
// for (const block of blocks) {
//   if (currHash !== block.hash) continue;
//   block.valid = true;
//   currHash = block.previousHash;
// }

// const validBlocks = blocks.filter(b => b.valid).reverse();
// for (let i = 0; i < headBlock.height + 1; i++) {
//   if (i === validBlocks[i].height) continue;
//   console.error("something is wrong with the valid chain");
//   process.exit();
// }

// let utxos = [];

// // construct utxo set
// for (let i = 0; i < headBlock.height + 1; i++) {
//   for (const transaction of validBlocks[i].transactions) {
//     // remove inputs from utxos
//     for (const input of transaction.inputs) {
//       const utxoIndex = utxos.findIndex(
//         utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
//       );
//       if (utxoIndex === -1) {
//         console.error("utxo does not exist on valid block!");
//         process.exit();
//       }
//       const utxo = utxos[utxoIndex];
//       input.address = utxo.address;
//       input.amount = utxo.amount;

//       for (const block of validBlocks) {
//         for (const tx of block.transactions) {
//           if (tx.hash !== utxo.txHash) continue;
//           tx.outputs[utxo.outIndex].txHash = transaction.hash; // record spending tx in output
//         }
//       }

//       utxos.splice(utxoIndex, 1);
//     }

//     // add outputs to utxos
//     for (let j = 0; j < transaction.outputs.length; j++) {
//       const output = transaction.outputs[j];
//       utxos.push({
//         txHash: transaction.hash,
//         outIndex: j,
//         address: output.address,
//         amount: output.amount,
//       });
//     }
//   }
// }

// console.log("utxos count", utxos.length);

process.exit();
// console.log(mempool);

// add to db
(async function () {
  await mongoose.connect(atlasURI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  });
  console.log("MongoDB database connection established to: ", network);

  await Blocks.deleteMany();
  await Blocks.insertMany(blocks);

  await Mempool.deleteMany();
  await Mempool.insertMany(mempool);

  mongoose.connection.close();
  console.log("updated db with blocks");
})();

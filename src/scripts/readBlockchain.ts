// @ts-nocheck
import BlockCrypto from "blockcrypto";
import fs from "fs";
// import blockSchema from "../models/block2.model";
import mongoose from "mongoose";
import { atlasURI, network } from "../config";

const { calculateBlockHash } = BlockCrypto;

const filePath = process.argv[2] ?? "./output.json";

const { blocks, mempool } = JSON.parse(fs.readFileSync(filePath));

blocks.sort((a, b) => a.height - b.height).reverse();

for (let i = 0; i < blocks.length; i++) {
  if (blocks[i].version === "1.2.0" || blocks[i].version === "0.1.0") {
    blocks[i].difficulty = blocks[i].difficulty.toFixed(4);
  }
  const actualHash = calculateBlockHash(blocks[i]);
  if (blocks[i].hash !== actualHash) {
    console.log("mismatch:", blocks[i].height, blocks[i].version, blocks[i].hash, actualHash);
  } else {
    // console.log(blocks[i].height, blocks[i].version);
  }
}

// find headblock as earlist highest block
const highest = blocks[0].height;
let headBlock = blocks[0];
for (const block of blocks) {
  if (block.height !== highest) break;
  if (headBlock.timestamp > block.timestamp) headBlock = block;
}
console.log("headblock height: ", headBlock.height);

let currHash = headBlock.hash;
for (const block of blocks) {
  if (currHash !== block.hash) continue;
  block.valid = true;
  currHash = block.previousHash;
}

const validBlocks = blocks.filter(b => b.valid).reverse();
for (let i = 0; i < headBlock.height + 1; i++) {
  if (i === validBlocks[i].height) continue;
  console.error("something is wrong with the valid chain");
  process.exit();
}

// new block schema
// const transactionSchema = new mongoose.Schema(
//   {
//     hash: { type: String, required: true },
//     timestamp: { type: Number, required: true },
//     version: { type: String, required: true },
//     inputs: [
//       {
//         txHash: { type: String, required: true },
//         outIndex: { type: Number, required: true },
//         publicKey: { type: String, required: true },
//         signature: { type: String, required: true },
//         _id: false,
//       },
//     ],
//     outputs: [
//       {
//         address: { type: String, required: true },
//         amount: { type: Number, required: true },
//         _id: false,
//       },
//     ],
//   },
//   {
//     versionKey: false,
//     _id: false,
//   }
// );

// const blockSchema = new mongoose.Schema(
//   {
//     valid: { type: Boolean, required: true, default: false },
//     height: { type: Number, required: true },
//     hash: { type: String, required: true, unique: true },
//     previousHash: { type: String },
//     timestamp: { type: Number, required: true },
//     version: { type: String, required: true },
//     difficulty: { type: Number, required: true },
//     nonce: { type: Number, required: true },
//     merkleRoot: { type: String, required: true },
//     transactions: [transactionSchema],
//   },
//   {
//     versionKey: false,
//   }
// );

// const Block = mongoose.model("new blocks", blockSchema);

// (async function () {
//   await mongoose.connect(atlasURI, {
//     useNewUrlParser: true,
//     useCreateIndex: true,
//     useUnifiedTopology: true,
//     useFindAndModify: false,
//   });
//   console.log("MongoDB database connection established to: ", network);

//   await Block.deleteMany();
//   await Block.insertMany(blocks);
//   mongoose.connection.close();
//   console.log("updated db with blocks");
// })();

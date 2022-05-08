// @ts-nocheck
import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { atlasURI, network, port } from "../config";

import blockRouter from "./routes/block.route";
import transactionRouter from "./routes/transaction.route";
import utxoRouter from "./routes/utxo.route";
import addressRouter from "./routes/address.route";

import { Block } from "./models";

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(blockRouter);
app.use(transactionRouter);
app.use(utxoRouter);
app.use(addressRouter);

const setup = async () => {
  const blocks = await Block.find().sort({ height: -1 }).lean();

  console.log("\nCalculating head block...");

  // find headblock as earlist highest block
  const highest = blocks[0].height; // highest block is first
  let headBlock = blocks[0];
  for (const block of blocks) {
    if (block.height !== highest) break;
    if (headBlock.timestamp > block.timestamp) headBlock = block;
  }
  console.log("headblock height:", headBlock.height);
  console.log("headblock hash:", headBlock.hash);

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

  console.log("\nCalculating utxo set...");

  let utxos = [];

  // construct utxo set
  for (let i = 0; i < headBlock.height + 1; i++) {
    for (const transaction of validBlocks[i].transactions) {
      // remove inputs from utxos
      for (const input of transaction.inputs) {
        const utxoIndex = utxos.findIndex(
          utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
        );
        if (utxoIndex === -1) {
          console.error("utxo does not exist on valid block!");
          process.exit();
        }
        utxos.splice(utxoIndex, 1);
      }

      // add outputs to utxos
      for (let j = 0; j < transaction.outputs.length; j++) {
        const output = transaction.outputs[j];
        utxos.push({
          txHash: transaction.hash,
          outIndex: j,
          address: output.address,
          amount: output.amount,
        });
      }
    }
  }

  console.log("utxos count:", utxos.length);

  app.locals.headBlock = headBlock;
  app.locals.utxos = utxos;
};

(async function () {
  const welcomeText = fs.readFileSync(path.join(__dirname, "..", "..", "welcome.txt"), "utf8");
  console.log("Starting Bobcoin Node (NEW)");
  console.log(welcomeText);
  console.log("Network:", network);
  try {
    // mongodb connection
    await mongoose.connect(atlasURI, {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    console.log("MongoDB database connection established");
  } catch (e) {
    console.error("could not connect to mongodb:", e);
  }
  await setup();
  server.listen(port, () => console.log("\nBobcoin Node listening on port:", port));
})();

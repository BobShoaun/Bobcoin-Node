import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import io from "socket.io-client";
import { mongoURI, network, port, whitelistedNodeUrls } from "./config";

import blockRouter from "./routes/block.route";
import transactionRouter from "./routes/transaction.route";
import utxoRouter from "./routes/utxo.route";
import addressRouter from "./routes/address.route";
import mineRouter from "./routes/mine.route";
import mempoolRouter from "./routes/mempool.route";
import walletRouter from "./routes/wallet.route";
import faucetRouter from "./routes/faucet.route";
import blockchainRouter from "./routes/blockchain.route";

import { checkDatabaseConn } from "./middlewares/mongo.middleware";
import { getValidMempool } from "./controllers/mempool.controller";
import { getHeadBlock, calculateDifficulty } from "./controllers/blockchain.controller";
import { getUtxos } from "./controllers/utxo.controller";
import { recalculateCache } from "./helpers/general.helper";
import params from "./params";

import { validateBlock } from "./controllers/validation.controller";
import { Block, BlockInfo } from "./models/types";
import { calculateBlockHash } from "blockcrypto";
import { Blocks, BlocksInfo, Mempool, Utxos } from "./models";

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(checkDatabaseConn);

app.use(blockRouter);
app.use(transactionRouter);
app.use(utxoRouter);
app.use(addressRouter);
app.use(mineRouter);
app.use(mempoolRouter);
app.use(walletRouter);
app.use(faucetRouter);
app.use(blockchainRouter);

app.get("/", async (_, res) => {
  const headBlock = await getHeadBlock();
  const message = `
    <h1>Bobcoin Node v${process.env.npm_package_version}</h1>
    <pre>Network: ${network}</pre>
    <pre>Parameters: ${JSON.stringify(params, null, 2)}</pre>
    <pre>Head block: ${JSON.stringify(headBlock, null, 2)}</pre>
    <pre>Difficulty: ${await calculateDifficulty(headBlock)}</pre>
    <pre>Valid Mempool: ${JSON.stringify(await getValidMempool(), null, 2)}</pre>
    `;
  // <pre>Utxos: ${JSON.stringify(await getUtxos(), null, 2)}</pre>
  res.send(message);
});
app.all("*", (_, res) => res.sendStatus(404));

(async function () {
  const welcomeText = fs.readFileSync(path.join(__dirname, "..", "welcome.txt"), "utf8");
  console.log(`Starting Bobcoin Node v${process.env.npm_package_version}`);
  console.log(welcomeText);
  console.log("Network:", network);
  try {
    // mongodb connection
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    console.log("MongoDB database connection established");
  } catch (e) {
    console.error("could not connect to mongodb:", e);
  }

  await recalculateCache();

  // setup socket io server
  const socketServer = new Server(server, { cors: { origin: "*" } }); // TODO: change for security
  socketServer.on("connection", async socket => {
    console.log("Client connected:", socket.conn.server.clientsCount, "total");

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.conn.server.clientsCount, "total");
    });

    socket.on("get-blockchain", () => {
      console.log("someone wants blockcahin");
    });

    socket.emit("initialize", {
      params,
      headBlock: await getHeadBlock(),
      mempool: await getValidMempool(),
    });
  });
  app.locals.io = socketServer;

  // setup socket io client
  for (const nodeUrl of whitelistedNodeUrls) {
    const socketClient = io(nodeUrl);
    socketClient.on("connection", () => {
      console.log("connected to socket", nodeUrl);
    });
    // socketClient.on("initialize", () => {
    //   console.log("socket client init");
    // });

    // socketClient.emit("get-blockchain");

    socketClient.on("node-block", block => {
      console.log("received block", block);
    });
  }

  const blocksCount = await Blocks.countDocuments();
  const blocksInfoCount = await BlocksInfo.countDocuments();
  const utxosCount = await Utxos.countDocuments();
  const mempoolCount = await Mempool.countDocuments();

  if (!blocksCount && !blocksInfoCount && !utxosCount && !mempoolCount) {
    // setup blockchain, add genesis block
    console.log("Genesis block does not exist, creating.");
    await Blocks.create(params.genesisBlock);
    const blockInfo = { ...params.genesisBlock, valid: true } as BlockInfo;
    await BlocksInfo.create(blockInfo);

    for (const transaction of blockInfo.transactions) {
      for (let i = 0; i < transaction.outputs.length; i++) {
        const { address, amount } = transaction.outputs[i];
        await Utxos.create({ txHash: transaction.hash, outIndex: i, address, amount });
      }
    }
  }

  if (blocksCount !== blocksInfoCount) {
    console.error("FATAL: blocks and blocksInfo database not in sync!");
    process.exit();
  }

  const _port = process.env.PORT ?? port; // have to bind as late as possible for heroku
  server.listen(_port, () => console.log("\nBobcoin Node listening on port:", _port));
})();

const healthCheck = () => {
  // assert genesis does not exist but blocks empty
  // assert Blocks empty
  // assert Blocks.count === BlocksInfo.count
  // assert Blocks gblock is same as BlocksInfo gblock
};

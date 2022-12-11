import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import io from "socket.io-client";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import queue from "express-queue";

import { network, port, whitelistedNodeUrls, canRecalcCache, isProduction, blockQueueLimit } from "./config";
import blockRouter from "./routes/block.route";
import transactionRouter from "./routes/transaction.route";
import utxoRouter from "./routes/utxo.route";
import addressRouter from "./routes/address.route";
import mineRouter from "./routes/mine.route";
import mempoolRouter from "./routes/mempool.route";
import walletRouter from "./routes/wallet.route";
import faucetRouter from "./routes/faucet.route";
import blockchainRouter from "./routes/blockchain.route";
import poolRouter from "./routes/pool.route";

import { checkDatabaseConn } from "./middlewares/mongo.middleware";
import { getValidMempool } from "./controllers/mempool.controller";
import { getHeadBlock, calculateDifficulty } from "./controllers/blockchain.controller";
import { getUtxos } from "./controllers/utxo.controller";
import { connectMongoDB } from "./helpers/database.helper";
import { recalculateCache } from "./helpers/general.helper";
import params from "./params";

import { validateBlock } from "./controllers/validation.controller";
import { Block, BlockInfo } from "./models/types";
import { Blocks, BlocksInfo, Mempool, Utxos } from "./models";

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.enable("trust proxy");
app.use(morgan("combined"));

app.locals.blockQueue = queue({
  activeLimit: 1,
  queuedLimit: blockQueueLimit,
});
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
});
app.use(apiLimiter);
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
app.use(poolRouter);

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
app.get("/ip", (req, res) => res.send(req.ip));
app.all("*", (_, res) => res.sendStatus(404));

(async () => {
  const welcomeText = fs.readFileSync(path.join(__dirname, "..", "welcome.txt"), "utf8");
  console.log(`Starting Bobcoin Node v${process.env.npm_package_version}`);
  console.log(welcomeText);
  console.log("Network:", network);

  await connectMongoDB();

  if (canRecalcCache) await recalculateCache();

  // setup socket io server
  const socketServer = new Server(server, { cors: { origin: "*" } }); // TODO: change for security
  socketServer.on("connection", async socket => {
    console.log("Client connected:", socket.conn.server.clientsCount, "total");

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.conn.server.clientsCount, "total");
    });

    socket.emit("initialize", {
      params,
      headBlock: await getHeadBlock(),
      mempool: await getValidMempool(),
    });
  });
  app.locals.io = socketServer;

  // setup socket io client
  // for (const nodeUrl of whitelistedNodeUrls) {
  //   console.log("nodeUrl", nodeUrl);
  //   const socketClient = io(nodeUrl);
  //   socketClient.on("connection", () => {
  //     console.log("connected to socket", nodeUrl);
  //   });
  //   socketClient.on("initialize", () => {
  //     console.log("socket client init");
  //   });

  //   // socketClient.emit("get-blockchain");

  //   socketClient.on("new-block", block => {
  //     console.log("received block", block);
  //   });
  // }

  const blocksCount = await Blocks.countDocuments();
  const blocksInfoCount = await BlocksInfo.countDocuments();
  const utxosCount = await Utxos.countDocuments();
  const mempoolCount = await Mempool.countDocuments();

  if (!blocksCount && !blocksInfoCount && !utxosCount && !mempoolCount) {
    // setup blockchain, add genesis block
    console.log("Genesis block does not exist, creating.");
    await Blocks.create(params.genesisBlock);
    const blockInfo = { ...params.genesisBlock, valid: true };
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

  server.listen(port, () => console.log("\nBobcoin Node listening on port:", port));
})();

const healthCheck = () => {
  // assert genesis does not exist but blocks empty
  // assert Blocks empty
  // assert Blocks.count === BlocksInfo.count
  // assert Blocks gblock is same as BlocksInfo gblock
};

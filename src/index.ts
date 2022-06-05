import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { mongoURI, network, port } from "./config";

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

  // setup socket io
  const io = new Server(server, { cors: { origin: "*" } });
  io.on("connection", async socket => {
    console.log("A client connected.");

    socket.on("disconnect", () => {
      console.log("A client disconnected.");
    });

    socket.emit("initialize", {
      params,
      headBlock: await getHeadBlock(),
      mempool: await getValidMempool(),
    });
  });
  app.locals.io = io;

  const _port = process.env.PORT ?? port; // have to bind at late as possible for heroku
  server.listen(_port, () => console.log("\nBobcoin Node listening on port:", _port));
})();

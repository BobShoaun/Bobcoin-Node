import http from "http";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { atlasURI, network, port } from "./config.js";

import { socket } from "./socket.js";
import { blocksRouter } from "./routes/block.route.js";
import { blockchainRouter } from "./routes/blockchain.route.js";
import { transactionRouter } from "./routes/transaction.route.js";
import { consensusRouter } from "./routes/consensus.route.js";
import { addressRouter } from "./routes/address.route.js";
import { mineRouter } from "./routes/mine.route.js";
import { utxoRouter } from "./routes/utxo.route.js";
import { testRouter } from "./routes/test.route.js";
import faucetRouter from "./routes/faucet.route.js";
import { handlerErrors } from "./middlewares/general.middleware.js";

import params from "./params.js";

import { setupUnconfirmedBlocks } from "./controllers/blockchain.controller.js";
import { resetMigration, phase1, phase2, phase3 } from "./controllers/migrate.controller.js";

const app = express();
const server = http.createServer(app);

// socket.io
const io = socket(server, app.locals);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/block", blocksRouter(io));
app.use("/blockchain", blockchainRouter());
app.use("/transaction", transactionRouter(io));
app.use("/consensus", consensusRouter());
app.use("/address", addressRouter());
app.use("/mine", mineRouter());
app.use("/utxo", utxoRouter());
app.use("/test", testRouter());
app.use("/faucet", faucetRouter);

app.get("/", (req, res) => {
  const message = `
  <h2>Bobcoin Node</h2>
  <pre>Network: ${network}</pre>
  <pre>Parameters: ${JSON.stringify(params, null, 2)}</pre>
  <pre>Head block: ${JSON.stringify(req.app.locals.headBlock, null, 2)}</pre>
  <pre>Difficulty: ${req.app.locals.difficulty}</pre>
  <pre>Unconfirmed blocks: ${JSON.stringify(req.app.locals.unconfirmedBlocks, null, 2)}</pre>
  <pre>Mempool: ${JSON.stringify(req.app.locals.mempool, null, 2)}</pre>
  <pre>Utxos: ${JSON.stringify(req.app.locals.utxos, null, 2)}</pre>
  `;
  res.send(message);
});

app.use(handlerErrors);

app.locals.socket = io;
app.locals.hello = "HELOO";
app.locals.headBlock = null;
app.locals.unconfirmedBlocks = []; // sorted by descending height
app.locals.mempool = []; // mempool as of headblock, recalc with reorg
app.locals.utxos = []; // utxos as of headblock, recalc with reorg
app.locals.difficulty = params.initBlkDiff;

(async function () {
  console.log("Starting Bobcoin Node...");
  try {
    // mongodb connection
    await mongoose.connect(atlasURI, {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    console.log("MongoDB database connection established to: ", network);

    // await resetMigration();
    // await phase1();
    // await phase2();
    // await phase3();
    await setupUnconfirmedBlocks(app.locals);

    server.listen(port, () => console.log("Server listening on port: ", port));
  } catch (e) {
    console.error("could not connect to mongodb:", e);
  }
})();

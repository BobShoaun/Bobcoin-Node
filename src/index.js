import http from "http";
import Express from "express";
import cors from "cors";

import { port } from "./config.js";
import { socket } from "./socket.js";
import { mongodb } from "./mongodb.js";
import { network } from "./config.js";
import { blocksRouter } from "./routes/block.route.js";
import { blockchainRouter } from "./routes/blockchain.route.js";
import { transactionRouter } from "./routes/transaction.route.js";
import { consensusRouter } from "./routes/consensus.route.js";
import { addressRouter } from "./routes/address.route.js";
import { mineRouter } from "./routes/mine.route.js";
import { utxoRouter } from "./routes/utxo.route.js";

import params from "./params.js";

import { resetMigration, phase1, phase2, phase3 } from "./controllers/migrate.controller.js";
import { setupUnconfirmedBlocks } from "./controllers/blockchain.controller.js";

const app = Express();
const server = http.createServer(app);

app.get("/", (req, res) => {
	const message = `
  <h2>Bobcoin Node</h2>
  <pre>Network: ${network}</pre>
  <pre>Parameters: ${JSON.stringify(params, null, 2)}</pre>
  <pre>Head block: ${JSON.stringify(req.app.locals.headBlock, null, 2)}</pre>
  <pre>Unconfirmed blocks: ${JSON.stringify(req.app.locals.unconfirmedBlocks, null, 2)}</pre>
  <pre>Mempool: ${JSON.stringify(req.app.locals.mempool, null, 2)}</pre>
  <pre>Utxos: ${JSON.stringify(req.app.locals.utxos, null, 2)}</pre>
  `;
	res.send(message);
});

app.locals.headBlock = null;
app.locals.unconfirmedBlocks = []; // sorted by descending height
app.locals.mempool = []; // mempool as of headblock, recalc with reorg
app.locals.utxos = []; // utxos as of headblock, recalc with reorg
app.locals.difficulty = params.initBlkDiff;

server.listen(port, async () => {
	console.log("Server listening on port: ", port);
	// await resetMigration();
	// await phase1();
	// await phase2();
	setupUnconfirmedBlocks(app.locals);
	// await phase3();
});

// const exit = () => {
// 	console.log("shutting down server");
// 	// await dumpUnconfirmed();
// };

// process.on("exit", exit.bind(null));
// process.on("SIGINT", exit.bind(null));
// process.on("SIGUSR1", exit.bind(null));
// process.on("SIGUSR2", exit.bind(null));
// process.on("uncaughtException", exit.bind(null));

mongodb();
const io = socket(server, app.locals);

app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
app.use(cors());

app.use("/block", blocksRouter(io));
app.use("/blockchain", blockchainRouter());
app.use("/transaction", transactionRouter(io));
app.use("/consensus", consensusRouter());
app.use("/address", addressRouter());
app.use("/mine", mineRouter());
app.use("/utxo", utxoRouter());

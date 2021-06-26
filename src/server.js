import http from "http";
import Express from "express";
import cors from "cors";

import { port } from "./config.js";
import { socket } from "./socket.js";
import { mongodb } from "./mongodb.js";
import { network } from "./config.js";
import { blocksRouter } from "./routes/block.route.js";
import { blockchainRouter } from "./routes/blockchain.route.js";
import { transactionsRouter } from "./routes/transactions.route.js";
import { consensusRouter } from "./routes/consensus.route.js";
import { addressRouter } from "./routes/address.route.js";
import { mineRouter } from "./routes/mine.route.js";

const app = Express();
const server = http.createServer(app);

app.get("/", (req, res) => {
	const message = `<h2>Bobcoin node: running on ${network}</h2>
  <h4>Time since last start: ${new Date().toLocaleString()}</h4>`;
	res.send(message);
});

server.listen(port, () => {
	console.log("Server listening on port: ", port);
});

mongodb();
const io = socket(server);

app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
app.use(cors());

app.use("/block", blocksRouter(io));
app.use("/blockchain", blockchainRouter(io));
app.use("/transactions", transactionsRouter(io));
app.use("/consensus", consensusRouter());
app.use("/address", addressRouter());
app.use("/mine", mineRouter());

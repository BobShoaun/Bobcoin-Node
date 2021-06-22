import http from "http";
import Express from "express";
import cors from "cors";

import { port } from "./config.js";
import { socket } from "./socket.js";
import { mongodb } from "./mongodb.js";
import { network } from "./config.js";
import { blocksRouter } from "./routes/blocks.route.js";
import { transactionsRouter } from "./routes/transactions.route.js";
import { consensusRouter } from "./routes/consensus.route.js";
import { addressRouter } from "./routes/address.route.js";

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

app.use("/blocks", blocksRouter(io));
app.use("/transactions", transactionsRouter(io));
app.use("/consensus", consensusRouter());
app.use("/address", addressRouter());

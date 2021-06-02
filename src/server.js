import http from "http";
import Express from "express";
import cors from "cors";

import { port } from "./settings.js";
import { socket } from "./socket.js";
import { mongodb } from "./mongodb.js";
import { blocksRouter } from "./routes/blocks.route.js";
import { transactionsRouter } from "./routes/transactions.route.js";

const app = Express();
const server = http.createServer(app);

app.get("/", (req, res) => {
	res.send("Welcome to the only Bobcoin Node");
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

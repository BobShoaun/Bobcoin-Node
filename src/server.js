import http from "http";
import Express from "express";
import cors from "cors";

import { socket } from "./socket.js";
import { mongodb } from "./mongodb.js";
import { blocksRouter } from "./routes/blocks.js";
import { transactionsRouter } from "./routes/transactions.js";

const app = Express();
const server = http.createServer(app);
const port = process.env.port || 3001;

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

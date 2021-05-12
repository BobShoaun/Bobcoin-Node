import http from "http";
import Express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { Server } from "socket.io";

import blocksRouter from "./routes/blocks.js";
import Block from "./models/block.model.js";
import Transaction from "./models/transaction.models.js";

dotenv.config();

const app = Express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "*",
	},
});

const port = process.env.port || 3001;
const uri = process.env.ATLAS_URI;

app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
app.use(cors());

try {
	mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
} catch {
	console.error("could not connect");
}

const connection = mongoose.connection;
connection.once("open", () => {
	console.log("MongoDB database connection established");
});

app.use("/blocks", blocksRouter);
// app.use('/transactions', transactionsRouter);

app.get("/", (req, res) => {
	res.send("<h1>hello serveeeer</h1>");
});

server.listen(port, () => {
	console.log("Server started on port: ", port);
});

io.on("connection", async socket => {
	socket.on("disconnect", () => {
		console.log("user disconnected");
	});
	socket.on("new block", async block => {
		socket.broadcast.emit("add block", block);
		const newBlock = new Block(block);
		await newBlock.save();
		console.log("added block to db: ", newBlock);
	});
	socket.on("new transaction", async transaction => {
		socket.broadcast.emit("add transaction", transaction);
		const newTx = new Transaction(transaction);
		await newTx.save();
		console.log("added tx: ", newTx);
	});

	console.log("a user connected");

	const blocks = await Block.find();
	socket.emit("all blocks", blocks);

	const transactions = await Transaction.find();
	socket.emit("all transactions", transactions);
});

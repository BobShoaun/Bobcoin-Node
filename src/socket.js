import { Server } from "socket.io";

import Block from "./models/block.model.js";
import Transaction from "./models/transaction.model.js";
import params from "./params.js";

export const socket = server => {
	const io = new Server(server, {
		cors: {
			origin: "*",
		},
	});

	io.on("connection", async socket => {
		socket.on("disconnect", () => {
			console.log("user disconnected");
		});
		socket.on("block", async block => {
			socket.broadcast.emit("block", block);
			const newBlock = new Block(block);
			await newBlock.save();
			console.log("added block to db: ", newBlock);
		});
		socket.on("transaction", async transaction => {
			socket.broadcast.emit("transaction", transaction);
			const newTx = new Transaction(transaction);
			await newTx.save();
			console.log("added tx: ", newTx);
		});

		console.log("a user connected");

		const blocks = await Block.find();
		socket.emit("blockchain", blocks);
		socket.emit("params", params);

		// const transactions = await Transaction.find();
		// socket.emit("all transactions", transactions);
	});

	return io;
};

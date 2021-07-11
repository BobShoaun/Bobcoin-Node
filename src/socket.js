import { Server } from "socket.io";
import { getMempoolInfo } from "./controllers/transaction.controller.js";

export const socket = (server, locals) => {
	const io = new Server(server, {
		cors: {
			origin: "*",
		},
	});

	io.on("connection", async socket => {
		socket.on("disconnect", () => {
			console.log("a peer disconnected");
		});

		// socket.on("block", async block => {
		// 	try {
		// 		addBlock(block);
		// 		socket.broadcast.emit("block", block);
		// 		console.log(`block ${block.hash} accepted and relayed`);
		// 	} catch (e) {
		// 		console.error(e);
		// 	}
		// });

		// socket.on("transaction", async transaction => {
		// 	try {
		// 		addTransaction(transaction);
		// 		socket.broadcast.emit("transaction", transaction);
		// 		console.log(`transaction ${transaction.hash} accepted and relayed`);
		// 	} catch (e) {
		// 		console.error(e);
		// 	}
		// });

		console.log("a peer connected");

		socket.emit("block", {
			headBlock: locals.headBlock,
			mempool: getMempoolInfo(locals),
			unconfirmedBlocks: locals.unconfirmedBlocks,
		});
	});

	return io;
};

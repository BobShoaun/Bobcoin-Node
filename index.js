import http from "http";
import Express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { Server } from "socket.io";

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

io.on("connection", socket => {
	console.log("a user connected");
	socket.on("disconnect", () => {
		console.log("user disconnected");
	});
	socket.on("add block", block => {
    socket.broadcast.emit('incoming block', block);
		console.log("added: ", block);
	});
});

try {
	mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
} catch {
	console.error("could not connect");
}
const connection = mongoose.connection;
connection.once("open", () => {
	console.log("MongoDB database connection established");
});

import blocksRouter from "./routes/blocks.js";
// import transactionsRouter from './routes/transactions';

app.use("/blocks", blocksRouter);
// app.use('/transactions', transactionsRouter);

app.get("/", (req, res) => {
	res.send("<h1>hello serveeeer</h1>");
});

server.listen(port, () => {
	console.log("Server started on port: ", port);
});

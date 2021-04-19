import Express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const app = Express();
const port = process.env.port || 3001;
let blocks = [];

app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));

const uri = process.env.ATLAS_URI;

try {
	mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
} catch {
	console.error("could not connect");
}
const connection = mongoose.connection;
connection.once("open", () => {
	console.log("MongoDB database connection established");
});

import blocksRouter from './routes/blocks.js';
// import transactionsRouter from './routes/transactions';

app.use('/blocks', blocksRouter);
// app.use('/transactions', transactionsRouter);

app.get("/", (req, res) => {
	res.send("<h1>hello serveeeer</h1>");
});

app.listen(port, () => {
	console.log("Server started on port: ", port);
});

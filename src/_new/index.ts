// @ts-nocheck
import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { atlasURI, network, port } from "../config";

import blockRouter from "./routes/block.route";
import transactionRouter from "./routes/transaction.route";
import utxoRouter from "./routes/utxo.route";
import addressRouter from "./routes/address.route";
import mineRouter from "./routes/mine.route";
import mempoolRouter from "./routes/mempool.route";

import { checkDatabaseConn } from "./middlewares/mongo.middleware";
import { BlocksInfo } from "./models";
import { recalculateCache } from "./helpers/general.helper";
import params from "./params";

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(checkDatabaseConn);

app.use(blockRouter);
app.use(transactionRouter);
app.use(utxoRouter);
app.use(addressRouter);
app.use(mineRouter);
app.use(mempoolRouter);

app.get("/", (_, res) => res.send("Hello from Bobcoin Node API"));
app.all("*", (_, res) => res.sendStatus(404));

const setup = async () => {
  const blocks = await BlocksInfo.find().sort({ height: -1 }).lean();
  const maxHeight = blocks[0].height;
  const headBlock = blocks.find(block => block.height === maxHeight && block.valid);
  app.locals.headBlock = headBlock;
};

(async function () {
  const welcomeText = fs.readFileSync(path.join(__dirname, "..", "..", "welcome.txt"), "utf8");
  console.log(`Starting Bobcoin Node v${process.env.npm_package_version}`);
  console.log(welcomeText);
  console.log("Network:", network);
  try {
    // mongodb connection
    await mongoose.connect(atlasURI, {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    console.log("MongoDB database connection established");
  } catch (e) {
    console.error("could not connect to mongodb:", e);
  }

  // await recalculateCache();
  await setup();

  const io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", async socket => {
    console.log("a client connected.");

    socket.on("disconnect", () => {
      console.log("a client disconnected.");
    });

    socket.emit("initialize", {
      params,
      headBlock: app.locals.headBlock,
    });
  });

  server.listen(port, () => console.log("\nBobcoin Node listening on port:", port));
})();

import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { mongoURI, network, port } from "./config";

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", async (_, res) => {
  res.send("HELLO WROLD");
});
app.all("*", (_, res) => res.sendStatus(404));

(async function () {
  // setup socket io
  //   const io = new Server(server, { cors: { origin: "*" } });
  //   io.on("connection", async socket => {
  //     console.log("A client connected.");

  //     socket.on("disconnect", () => {
  //       console.log("A client disconnected.");
  //     });

  //     socket.emit("initialize", {
  //       params,
  //       headBlock: await getHeadBlock(),
  //       mempool: await getValidMempool(),
  //     });
  //   });
  //   app.locals.io = io;

  server.listen(port, () => console.log("\nBobcoin Node listening on port:", port));
})();

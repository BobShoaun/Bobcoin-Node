import io from "socket.io-client";
import axios from "axios";
import { hexToBigInt } from "blockcrypto";
import { Worker } from "worker_threads";

const nodeUrl = "https://alpha.mainnet.bobcoin.cash";
const miner = "8bobLqxCRPTSEhvZwQTeKnKz5429N26";

const workers = [];
const numWorkers = 2;

const socketClient = io(nodeUrl);

socketClient.on("initialize", async ({ params, headBlock, mempool }) => {
  mine(headBlock);
});

socketClient.on("block", ({ headBlock, mempool }) => {
  console.log("new block", headBlock);
  mine(headBlock);
});

const mine = async previousBlock => {
  while (workers.length) {
    const worker = workers.pop();
    worker.terminate();
  }

  const { data } = await axios.post(new URL("/mine/candidate-block", nodeUrl).toString(), {
    miner,
    previousBlockHash: previousBlock.hash,
  });

  const { validation, block, target } = data;

  if (validation.code !== 400) {
    console.log("ERROR IN candidate block validation");
    return;
  }

  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker(`${__dirname}/mine.worker.js`, {
      workerData: { initialNonce: i, increment: numWorkers },
    });
    worker.on("message", async data => {
      switch (data.message) {
        case "nonce":
          console.log("nonce reached", data.block.nonce);
          break;
        case "print":
          console.log(data.data);
          break;
        case "success":
          console.log("mining success", data.block);
          const { validation, blockInfo } = (await axios.post(`${nodeUrl}/block`, data.block)).data;

          if (validation.code !== 400) {
            console.error("Block is invalid", blockInfo);
          }

          break;
        default:
          console.error("invalid worker case");
      }
    });

    worker.on("error", error => {
      console.log("worker error:", error);
    });

    worker.on("exit", exitCode => {
      console.log("worker exited:", exitCode);
    });

    console.log("mining from block:", previousBlock.hash);
    console.log("target:", target);
    worker.postMessage({ block, target: hexToBigInt(target) });

    workers.push(worker);
  }
};

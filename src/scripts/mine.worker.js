const { parentPort, workerData } = require("worker_threads");
const { mineBlock, calculateBlockHash } = require("blockcrypto");

const { initialNonce, increment } = workerData;

const mine = ({ block, target }) => {
  // for (block of mineBlock(block, target)) {
  //   if (block.nonce % 40000 === 0) parentPort.postMessage({ message: "nonce", block });
  // }

  block.nonce = initialNonce;

  while (true) {
    block.hash = calculateBlockHash(block);
    const currentHash = BigInt("0x" + block.hash);
    if (currentHash <= target) {
      // mining successful
      parentPort.postMessage({ message: "success", block });
      break;
    }

    if ((block.nonce - initialNonce) % 80000 === 0)
      parentPort.postMessage({ message: "print", data: `${initialNonce}: ${block.nonce}` });

    // if (block.nonce % 40000 === 0) parentPort.postMessage({ message: "nonce", block });
    block.nonce += increment;
  }
};

parentPort.on("message", mine);

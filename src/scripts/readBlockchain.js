import BlockCrypto from "blockcrypto";
import fs from "fs";
import SHA256 from "crypto-js/sha256.js";
// const { calculateBlockHash } = BlockCrypto;

function calculateBlockHash(block) {
  return SHA256(
    block.height +
      block.previousHash +
      block.merkleRoot +
      block.timestamp +
      block.version +
      block.difficulty +
      block.nonce
  ).toString();
}

const filePath = process.argv[2] ?? "./output.json";

const { blocks, mempool } = JSON.parse(fs.readFileSync(filePath));
// console.log(JSON.parse(blocks));

blocks.sort((a, b) => a.height - b.height);

for (let i = 0; i < blocks.length; i++) {
  console.log(blocks[i].height);
  blocks[i].difficulty = blocks[i].difficulty.toFixed(4);
  const actualHash = calculateBlockHash(blocks[i]);
  if (blocks[i].hash !== actualHash) {
    console.log("mismatch:", blocks[i].hash, actualHash);
  }
}

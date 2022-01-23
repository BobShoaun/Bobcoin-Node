import BlockCrypto from "blockcrypto";
import fs from "fs";
const { calculateBlockHash } = BlockCrypto;

const filePath = process.argv[2] ?? "./output.json";

const { blocks, mempool } = JSON.parse(fs.readFileSync(filePath));

blocks.sort((a, b) => a.height - b.height);

for (let i = 0; i < blocks.length; i++) {
  console.log(blocks[i].height);
  blocks[i].difficulty = blocks[i].difficulty.toFixed(4);
  const actualHash = calculateBlockHash(blocks[i]);
  if (blocks[i].hash !== actualHash) {
    console.log("mismatch:", blocks[i].hash, actualHash);
  }
}

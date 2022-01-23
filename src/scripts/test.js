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

console.log(calculateBlockHash());

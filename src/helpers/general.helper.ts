import { Blocks, BlocksInfo, Utxos } from "../models";
import { BlockInfo } from "../models/types";

// export const checkBlocks = async (blocks) => {
//     blocks.sort((a, b) => a.height - b.height).reverse();

//     for (let i = 0; i < blocks.length; i++) {
//         if (blocks[i].version === "1.2.0" || blocks[i].version === "0.1.0") {
//           blocks[i].difficulty = blocks[i].difficulty.toFixed(4);
//         }
//         const actualHash = calculateBlockHash(blocks[i]);
//         if (blocks[i].hash !== actualHash) {
//           console.log("mismatch:", blocks[i].height, blocks[i].version, blocks[i].hash, actualHash);
//         } else {
//           // console.log(blocks[i].height, blocks[i].version);
//         }
//       }
// }

export const recalculateCache = async () => {
  const blocks = (await Blocks.find().sort({ height: -1 }).lean()) as BlockInfo[];

  console.log("\nCalculating head block...");

  // find headblock as earlist highest block
  const highest = blocks[0].height; // highest block is first
  let headBlock = blocks[0];
  for (const block of blocks) {
    if (block.height !== highest) break;
    if (headBlock.timestamp > block.timestamp) headBlock = block;
  }

  console.log("head block height:", headBlock.height);
  console.log("head block hash:", headBlock.hash);

  console.log("\nCalculating valid chain...");

  let currHash = headBlock.hash;
  for (const block of blocks) {
    if (currHash !== block.hash) continue;
    block.valid = true;
    currHash = block.previousHash;
  }

  // some checking w the valid chain
  const validBlocks = blocks.filter(b => b.valid).reverse();
  for (let i = 0; i < headBlock.height + 1; i++) {
    if (i === validBlocks[i].height) continue;
    console.error("something is wrong with the valid chain");
    process.exit();
  }

  console.log("\nCalculating utxos and block information...");

  const blocksPerHeight = []; // array of array
  for (const block of blocks) {
    if (blocksPerHeight[block.height]) {
      blocksPerHeight[block.height].push(block);
      continue;
    }
    blocksPerHeight[block.height] = [block];
  }

  const calculateBlocksInfo = (block, utxos = []) => {
    for (const transaction of block.transactions) {
      // remove inputs from utxos
      for (const input of transaction.inputs) {
        const utxoIndex = utxos.findIndex(
          utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
        );
        if (utxoIndex === -1) {
          console.error("utxo does not exist on transaction!");
          process.exit();
        }
        const utxo = utxos[utxoIndex];
        input.address = utxo.address;
        input.amount = utxo.amount;

        utxos.splice(utxoIndex, 1);

        if (!block.valid) continue;
        // record spenting tx hash in tx output only for valid chain

        for (let i = block.height - 1; i >= 0; i--) {
          const validBlock = blocksPerHeight[i].find(b => b.valid);
          const tx = validBlock.transactions.find(tx => tx.hash === utxo.txHash);
          if (tx) {
            tx.outputs[utxo.outIndex].txHash = transaction.hash;
            break;
          }
        }
      }

      // add outputs to utxos
      for (let j = 0; j < transaction.outputs.length; j++) {
        const output = transaction.outputs[j];
        utxos.push({
          txHash: transaction.hash,
          outIndex: j,
          address: output.address,
          amount: output.amount,
        });
      }
    }

    const nextBlocks =
      blocksPerHeight[block.height + 1]?.filter(b => b.previousHash === block.hash) ?? [];

    let headBlockUtxos = null;
    for (const nextBlock of nextBlocks) {
      const _utxos = calculateBlocksInfo(nextBlock, [...utxos]);
      if (_utxos) headBlockUtxos = _utxos;
    }
    if (headBlockUtxos) return headBlockUtxos;

    return block.hash === headBlock.hash ? utxos : null;
  };

  const utxos = calculateBlocksInfo(blocksPerHeight[0][0]);

  console.log("utxos count:", utxos.length);

  await BlocksInfo.deleteMany();
  await BlocksInfo.insertMany(blocks).catch(err => console.log(err));
  await Utxos.deleteMany();
  await Utxos.insertMany(utxos);

  console.log("\nCache calculation completed and stored in mongodb.");
};

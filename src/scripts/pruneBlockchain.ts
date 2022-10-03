import { mongoURI, network, port, whitelistedNodeUrls } from "../config";
import { Blocks, BlocksInfo, Mempool, Utxos } from "../models";

import { recalculateCache } from "../helpers/general.helper";
import { connectMongoDB } from "../helpers/database.helper";
import { BlockInfo } from "../models/types";

(async () => {
  await connectMongoDB();

  const blocks = (await BlocksInfo.find().sort({ height: -1 }).lean()) as BlockInfo[];

  const blocksPerHeight = []; // array of array
  for (const block of blocks) {
    if (blocksPerHeight[block.height]) {
      blocksPerHeight[block.height].push(block);
      continue;
    }
    blocksPerHeight[block.height] = [block];
  }

  const branches: [{ block: BlockInfo; branchHeight: number }] = [
    { block: blocksPerHeight[0][0], branchHeight: 1 },
  ];

  const blocksToPrune = [];

  while (branches.length) {
    const { block, branchHeight } = branches.shift();

    const nextBlocks =
      blocksPerHeight[block.height + 1]?.filter(b => b.previousHash === block.hash) ?? [];

    if (!block.valid && branchHeight === 1 && nextBlocks.length === 0) {
      console.log("need to remove", block.height, block.hash);
      blocksToPrune.push(block.hash);
    }

    for (const nextBlock of nextBlocks)
      branches.push({
        block: nextBlock,
        branchHeight: block.valid === nextBlock.valid ? branchHeight + 1 : 1,
      });
  }

  await BlocksInfo.deleteMany({ hash: { $in: blocksToPrune } });
  await Blocks.deleteMany({ hash: { $in: blocksToPrune } });

  console.log("blocks pruned");

  await recalculateCache();

  process.exit();
})();

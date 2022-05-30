import { Router, Request } from "express";
import { Blocks, BlocksInfo, Utxos, Mempool } from "../models";
import { validateBlock } from "../helpers/blockcrypto";
import { VCODE } from "../helpers/validation-codes";
import { getMempool } from "../controllers/mempool.controller";

const router = Router();

router.get("/blocks", async (req, res) => {
  const limit = parseInt(req.query.limit as string);
  const height = parseInt(req.query.height as string);

  const maxHeight = isNaN(height) ? Number.POSITIVE_INFINITY : height;
  const minHeight = isNaN(limit) || isNaN(height) ? Number.NEGATIVE_INFINITY : height - limit; // exclusive

  const blocks = await BlocksInfo.find(
    { height: { $lte: maxHeight, $gt: minHeight } },
    { _id: false }
  ).sort({ height: -1 });
  res.send(blocks);
});

router.get("/blocks/raw", async (req, res) => {
  const blocks = await Blocks.find({}, { _id: false });
  res.send(blocks);
});

router.get("/block/head", async (req, res) => {
  const headBlock = (
    await BlocksInfo.find({ valid: true }, { _id: 0 }).sort({ height: -1 }).limit(1)
  )[0];
  res.send(headBlock);
});

router.get("/blocks/height/:height", async (req: Request<{ height: number }>, res) => {
  const { height } = req.params;
  const blocks = await BlocksInfo.find({ height }, { _id: false }).sort({ valid: -1 }); // show valid ones first
  if (!blocks.length) return res.status(404).send(blocks);
  res.send(blocks);
});

const getBlockHeights = async (height: number, limit: number) =>
  await BlocksInfo.aggregate([
    { $group: { _id: "$height", blocks: { $push: "$$ROOT" } } },
    { $sort: { _id: -1 } },
    { $project: { _id: 0, blocks: 1, height: "$_id" } },
    { $match: { height: { $lte: height } } },
    { $limit: limit },
  ]);

router.get("/blocks/heights", async (req, res) => {
  const height = parseInt(req.query.height as string);
  const limit = parseInt(req.query.limit as string);
  const blockHeights = await getBlockHeights(height, limit);
  res.send(blockHeights);
});

router.get("/block/:hash", async (req, res) => {
  const { hash } = req.params;
  const block = await BlocksInfo.findOne({ hash }, { _id: false });
  if (!block) return res.sendStatus(404);
  res.send(block);
});

router.get("/block/:hash/raw", async (req, res) => {
  const { hash } = req.params;
  const block = await Blocks.findOne({ hash }, { _id: false });
  if (!block) return res.sendStatus(404);
  res.send(block);
});

// only for valid blocks, not orphaneds ones
const updateBlockInfo = async blockInfo => {
  for (const transaction of blockInfo.transactions) {
    for (const input of transaction.inputs) {
      // record spending tx in output
      const utxoBlock = await BlocksInfo.findOne({
        "transactions.hash": input.txHash,
        valid: true,
      });
      const output = utxoBlock.transactions.find(tx => tx.hash === input.txHash).outputs[
        input.outIndex
      ];
      // update input info
      input.address = output.address;
      input.amount = output.amount;
      // update output info
      if (blockInfo.valid) {
        output.txHash = transaction.hash;
        await utxoBlock.save();
      }
      await Utxos.deleteOne({ txHash: input.txHash, outIndex: input.outIndex });
    }
    for (let i = 0; i < transaction.outputs.length; i++) {
      const output = transaction.outputs[i];
      await Utxos.create({
        txHash: transaction.hash,
        outIndex: i,
        address: output.address,
        amount: output.amount,
      });
    }

    // remove tx from mempool
    await Mempool.deleteOne({ hash: transaction.hash });
  }
  await blockInfo.save();
};

router.post("/block", async (req, res) => {
  const block = req.body;
  if (!block) return res.sendStatus(400);

  // validate block
  const validation = await validateBlock(block);
  if (validation.code !== VCODE.VALID) return res.status(400).send({ validation, block });

  // const blockInfo = structuredClone(block);
  const blockInfo = new BlocksInfo(block);

  const headBlock = (
    await BlocksInfo.find({ valid: true }, { _id: 0 }).sort({ height: -1 }).limit(1)
  )[0]; // get head block

  // not building on best chain, set as invalid / orphaned
  if (blockInfo.height <= headBlock.height) {
    console.log("adding orphaned block.");
    blockInfo.valid = false;
    for (const transaction of blockInfo.transactions) {
      for (const input of transaction.inputs) {
        // TODO, trace back till you find utxo.
        // record spending tx in output
        const utxoBlock = await BlocksInfo.findOne({
          "transactions.hash": input.txHash,
          valid: true,
        });
        const output = utxoBlock.transactions.find(tx => tx.hash === input.txHash).outputs[
          input.outIndex
        ];
        // update input info
        input.address = output.address;
        input.amount = output.amount;
      }
    }
    await blockInfo.save();
  } else if (blockInfo.previousHash === headBlock.hash) {
    // common case
    blockInfo.valid = true;

    // populate transaction infos
    await updateBlockInfo(blockInfo);
  } else {
    // blockchain reorg required. fork happened
    const fork = []; // starting from block after common ancestor to block before current new block (new head)

    console.log("fork case");

    // find common ancestor
    let commonBlock = null;
    let currBlockHash = blockInfo.previousHash;
    while (currBlockHash) {
      const currBlock = await BlocksInfo.findOne({ hash: currBlockHash });
      if (currBlock.valid) {
        // block is in main chain, found common ancestor
        commonBlock = currBlock;
        break;
      }
      fork.push(currBlock);
      currBlockHash = currBlock.previousHash;
    }
    fork.reverse();

    console.log("common ancestor:", commonBlock.hash);

    // undo utxo history, starting from headBlock until common ancestor
    currBlockHash = headBlock.hash;
    while (currBlockHash) {
      const currBlock = await BlocksInfo.findOne({ hash: currBlockHash });

      console.log("undoing block:", currBlock.hash);

      for (const transaction of [...currBlock.transactions].reverse()) {
        // transaction.outputs.forEach(output => (output.txHash = null)); // clear spent tx output, since its no longer valid chain
        await Utxos.deleteMany({ txHash: transaction.hash });

        if (transaction.inputs.length) await Utxos.insertMany(transaction.inputs);
      }

      console.log("done undoing utxos");

      const mempoolTxs = currBlock.transactions.filter(tx => tx.inputs.length > 0); // return non coinbase txs back to mempool
      console.log("mempoolTxs", mempoolTxs);

      // remove txHash in outputs for txs return to mempool
      for (const tx of mempoolTxs) {
        await BlocksInfo.updateOne(
          { "transactions.outputs.txHash": tx.hash, valid: true },
          { "transactions.$.outputs.$[output].txHash": null },
          { arrayFilters: [{ "output.txHash": tx.hash }] }
        );
      }

      await Mempool.insertMany(mempoolTxs, { ordered: false }).catch(err => console.log(err)); // ordered false for ignoring duplicates

      console.log("isnerted back to mempool");

      currBlock.valid = false;
      await currBlock.save();

      if (currBlock.previousHash === commonBlock.hash) break;

      currBlockHash = currBlock.previousHash;
    }

    console.log("done unoding utxos and mempool");

    // retrace all forked blocks to valid blocks.
    for (const blockInfo of fork) {
      blockInfo.valid = true;
      await updateBlockInfo(blockInfo);
    }

    // update new block itself
    blockInfo.valid = true;
    await updateBlockInfo(blockInfo);
  }

  // add to raw blocks
  await Blocks.create(block);

  // TODO: set new head block

  console.log("Received and accepted block:", block.hash);

  // TODO, inform socket clients and propagate to other nodes.
  req.app.locals.io.emit("block", {
    headBlock: (
      await BlocksInfo.find({ valid: true }, { _id: 0 }).sort({ height: -1 }).limit(1)
    )[0],
    recentValidBlocks: await BlocksInfo.aggregate([
      { $group: { _id: "$height", blocks: { $push: "$$ROOT" } } },
      { $sort: { _id: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, blocks: 1, height: "$_id" } },
    ]),
    mempool: await getMempool(),
  });

  res.send({ validation, blockInfo });
});

export default router;

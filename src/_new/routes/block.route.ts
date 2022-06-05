import { Router, Request } from "express";
import { Blocks, BlocksInfo, Utxos, Mempool } from "../models";
import { validateBlock } from "../helpers/blockcrypto";
import { VCODE } from "../helpers/validation-codes";
import { getValidMempool } from "../controllers/mempool.controller";
import { Block } from "../models/types";
import { findUtxo } from "../helpers/blockchain.helper";
import { getHeadBlock } from "../controllers/blockchain.controller";

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
  const headBlock = await getHeadBlock();
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
const appendValidBlock = async blockInfo => {
  for (const transaction of blockInfo.transactions) {
    for (const input of transaction.inputs) {
      // record spending tx in output
      const utxoBlock = await BlocksInfo.findOne({
        "transactions.hash": input.txHash,
        valid: true,
      });
      const stxo = utxoBlock.transactions.find(tx => tx.hash === input.txHash).outputs[
        input.outIndex
      ];
      // update input info
      input.address = stxo.address;
      input.amount = stxo.amount;
      // update output info
      stxo.txHash = transaction.hash;
      await utxoBlock.save();
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

  const blockInfo = new BlocksInfo(block);
  const headBlock = await getHeadBlock();

  // not building on best chain, set as invalid / orphaned
  if (blockInfo.height <= headBlock.height) {
    console.log("Adding orphaned block:", blockInfo.height, blockInfo.hash);
    // find utxo for information
    for (const transaction of blockInfo.transactions) {
      for (const input of transaction.inputs) {
        const stxo = await findUtxo(blockInfo.previousHash, input.txHash, input.outIndex);
        // update input info
        input.address = stxo.address;
        input.amount = stxo.amount;
      }
    }
    blockInfo.valid = false;
    await blockInfo.save();
  } else if (blockInfo.previousHash === headBlock.hash) {
    // common case
    console.log("Appending block:", blockInfo.height, blockInfo.hash);
    blockInfo.valid = true;
    await appendValidBlock(blockInfo);
  } else {
    // blockchain reorg required. fork happened
    console.log("\nBlockchain fork reorganization for block:", blockInfo.height, blockInfo.hash);
    const fork = []; // starting from block after common ancestor to block before current new block (new head)

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

    // undo utxo history and return txs to mempool, starting from headBlock until common ancestor (valid block)
    currBlockHash = headBlock.hash;
    while (currBlockHash) {
      const currBlock = await BlocksInfo.findOne({ hash: currBlockHash });

      console.log("Undoing block:", currBlock.height, currBlock.hash);

      for (const transaction of [...currBlock.transactions].reverse()) {
        transaction.outputs.forEach(output => (output.txHash = null)); // clear spent tx output, since its no longer valid chain
        await Utxos.deleteMany({ txHash: transaction.hash });

        if (transaction.inputs.length) await Utxos.insertMany(transaction.inputs);
      }

      const mempoolTxs = currBlock.transactions.filter(tx => tx.inputs.length > 0); // return non coinbase txs back to mempool

      // remove txHash in outputs for txs returning to mempool
      for (const tx of mempoolTxs) {
        await BlocksInfo.updateOne(
          { "transactions.outputs.txHash": tx.hash, valid: true },
          { "transactions.$.outputs.$[output].txHash": null },
          { arrayFilters: [{ "output.txHash": tx.hash }] }
        );
      }

      await Mempool.insertMany(mempoolTxs, { ordered: false }).catch(() =>
        console.log("Potential mempool tx duplicated when returning.")
      ); // ordered false for ignoring duplicates

      currBlock.valid = false;
      await currBlock.save();

      if (currBlock.previousHash === commonBlock.hash) break;
      currBlockHash = currBlock.previousHash;
    }
    console.log("Common ancestor block:", commonBlock.height, commonBlock.hash);

    // retrace all forked blocks to valid blocks.
    for (const _blockInfo of [...fork.reverse(), blockInfo]) {
      console.log("Redoing block:", _blockInfo.height, _blockInfo.hash);
      _blockInfo.valid = true;
      await appendValidBlock(_blockInfo);
    }
  }

  // add to raw blocks
  await Blocks.create(block);

  // TODO, inform socket clients and propagate to other nodes.
  req.app.locals.io.emit("block", {
    headBlock: await getHeadBlock(),
    mempool: await getValidMempool(),
  });

  res.send({ validation, blockInfo });
});

export default router;

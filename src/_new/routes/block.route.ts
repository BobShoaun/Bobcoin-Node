// @ts-nocheck
import { Router } from "express";
import { Blocks, BlocksInfo, Utxos, Mempool } from "../models";
import { RESULT } from "blockcrypto";
// const { RESULT } = BlockCrypto;

const router = Router();

router.get("/blocks", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const height = parseInt(req.query.height);

  const maxHeight = isNaN(height) ? Number.POSITIVE_INFINITY : height;
  const minHeight = isNaN(limit) || isNaN(height) ? Number.NEGATIVE_INFINITY : height - limit; // exclusive

  const blocks = await BlocksInfo.find(
    { height: { $lte: maxHeight, $gt: minHeight } },
    { _id: false }
  ).sort({ height: -1 });
  res.send(blocks);
});

router.get("/block/head", async (req, res) => {
  const headBlock = req.app.locals.headBlock;
  res.send(headBlock);
});

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
  const isValid = true;
  if (!isValid) return res.status(400).send("Block is invalid");

  // const blockInfo = structuredClone(block);
  const blockInfo = new BlocksInfo(block);

  const headBlock = req.app.locals.headBlock;

  // not building on best chain, set as invalid / orphaned
  if (blockInfo.height <= headBlock.height) blockInfo.valid = false;
  else if (blockInfo.previousHash === headBlock.hash) {
    // common case
    blockInfo.valid = true;
    req.app.locals.headBlock = blockInfo; // new head block
  } else {
    // blockchain reorg required. fork happened
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
    fork.reverse();

    // undo utxo history, starting from headBlock until common ancestor
    currBlockHash = headBlock.hash;
    while (currBlockHash) {
      const currBlock = await BlocksInfo.findOne({ hash: currBlockHash });

      currBlock.valid = false;
      for (const transaction of [...currBlock.transactions].reverse()) {
        transaction.outputs.forEach(output => (output.txHash = null)); // clear spent tx output, since its no longer valid chain
        await Utxos.deleteMany({ txHash: transaction.hash });
        const utxos = transaction.inputs.map(input => ({
          txHash: input.txHash,
          outIndex: input.outIndex,
          address: input.address,
          amount: input.amount,
        }));
        await Utxos.insertMany(utxos);
      }

      const mempoolTxs = currBlock.transactions.map(tx => tx.inputs.length > 0); // return non coinbase txs back to mempool
      await Mempool.insertMany(mempoolTxs);

      await currBlock.save();

      if (currBlock.previousHash === commonBlock.hash) {
        break;
      }

      currBlockHash = currBlock.previousHash;
    }

    // retrace all forked blocks to valid blocks.
    for (const blockInfo of fork) {
      blockInfo.valid = true;
      await updateBlockInfo(blockInfo);
    }
  }

  // populate transaction infos
  await updateBlockInfo(blockInfo);

  // add to raw blocks
  // await Blocks.create(block);

  res.send(blockInfo);
});

export default router;

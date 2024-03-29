import { Blocks, BlocksInfo, Utxos, Mempool } from "../models";
import { validateBlock } from "../controllers/validation.controller";
import { VCODE } from "../helpers/validation-codes";
import { getValidMempool } from "../controllers/mempool.controller";
import { Block, Output, BlockInfo } from "../models/types";
import { getHeadBlock } from "../controllers/blockchain.controller";
import { distributeConfirmedPoolRewards } from "../controllers/pool.controller";

// only for valid blocks, not orphaneds ones
const appendValidBlock = async blockInfo => {
  for (const transaction of blockInfo.transactions) {
    for (const input of transaction.inputs) {
      // record spending tx in output
      let utxoBlock = blockInfo;

      // check own block first
      let stxo = utxoBlock.transactions.find(tx => tx.hash === input.txHash)?.outputs[input.outIndex];
      if (!stxo) {
        // check previous blocks
        utxoBlock = await BlocksInfo.findOne({
          "transactions.hash": input.txHash,
          valid: true,
        });
        stxo = utxoBlock.transactions.find(tx => tx.hash === input.txHash).outputs[input.outIndex];
      }

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

export const addBlock = [
  (req, res, next) => req.app.locals.blockQueue(req, res, next),
  async (req, res, next) => {
    const block = req.block;
    if (!block) return res.sendStatus(400);

    // validate block
    const validation = await validateBlock(block);
    if (validation.code !== VCODE.VALID) return res.status(400).send({ validation, block });

    const blockInfo = new BlocksInfo(block);
    const headBlock = await getHeadBlock();

    // not building on best chain, set as invalid / orphaned
    if (blockInfo.height <= headBlock.height) {
      console.log("Adding orphaned block:", blockInfo.height, blockInfo.hash);

      for (let i = 1; i < blockInfo.transactions.length; i++) {
        const transaction = blockInfo.transactions[i];

        for (const input of transaction.inputs) {
          let utxo: Output | null = null; // find utxo for information

          // check own block first
          for (const transaction of blockInfo.transactions.slice(0, i).reverse()) {
            if (transaction.inputs.some(_input => _input.txHash === input.txHash && _input.outIndex === input.outIndex))
              return res.sendStatus(500); // FATAL: utxo is stxo (spent)
            if (input.txHash === transaction.hash) {
              utxo = transaction.outputs[input.outIndex];
              break;
            }
          }

          if (!utxo) {
            let prevBlockHash = blockInfo.previousHash;
            // @ts-ignore
            outer: for await (const prevBlock of Blocks.find({ height: { $lt: blockInfo.height } }, { _id: 0 })
              .sort({ height: -1 })
              .lean() as Block[]) {
              if (prevBlockHash !== prevBlock.hash) continue; // wrong branch
              for (const transaction of [...prevBlock.transactions].reverse()) {
                if (
                  transaction.inputs.some(
                    _input => _input.txHash === input.txHash && _input.outIndex === input.outIndex
                  )
                )
                  return res.sendStatus(500); // FATAL: utxo is stxo (spent)
                if (input.txHash === transaction.hash) {
                  utxo = transaction.outputs[input.outIndex];
                  break outer;
                }
              }
              prevBlockHash = prevBlock.previousHash;
            }
          }

          if (!utxo) return res.sendStatus(500); // FATAL: utxo not found

          // update input info
          input.address = utxo.address;
          input.amount = utxo.amount;
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
      const fork: BlockInfo[] = []; // starting from block after common ancestor to block before current new block (new head)

      // find common ancestor
      let commonBlock: BlockInfo | null = null;
      let currBlockHash = blockInfo.previousHash;
      while (currBlockHash) {
        const currBlock = await BlocksInfo.findOne({ hash: currBlockHash });
        if (!currBlock) return res.status(500).send("currBlock not found!");
        if (currBlock.valid) {
          // block is in main chain, found common ancestor
          commonBlock = currBlock;
          break;
        }
        fork.push(currBlock);
        currBlockHash = currBlock.previousHash;
      }

      if (!commonBlock) return res.status(500).send("common block is null!");

      // undo utxo history and return txs to mempool, starting from headBlock until common ancestor (valid block)
      currBlockHash = headBlock.hash;
      while (currBlockHash) {
        const currBlock = await BlocksInfo.findOne({ hash: currBlockHash });
        if (!currBlock) return res.status(500).send("currBlock not found!");

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

    req.validation = validation;
    req.blockInfo = blockInfo;
    next();
  },
  // Release confirmed pool rewards transaction
  distributeConfirmedPoolRewards,
  async (req, res, next) => {
    // TODO, inform socket clients and propagate to other nodes.
    req.app.locals.io.emit("block", {
      headBlock: await getHeadBlock(),
      mempool: await getValidMempool(),
    });

    console.log("Block successfully added to blockchain!");
    next();
  },
];

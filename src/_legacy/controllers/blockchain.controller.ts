import BlockCrypto from "blockcrypto";

import params from "../params";
import {
  OrphanedBlock,
  MatureBlock,
  UnconfirmedBlock,
  MempoolTransaction,
  Utxo,
  TransactionInfo,
} from "../models/index";

import { cleanBlock } from "./migrate.controller";
import { getMempoolInfo } from "./transaction.controller";
import { getBlockByHeight } from "./block.controller";

import { validateBlock } from "./blockcrypto";

const { RESULT } = BlockCrypto;

const insertUnconfirmedBlock = (locals, block) => {
  for (let i = 0; i < locals.unconfirmedBlocks.length; i++) {
    if (block.height >= locals.unconfirmedBlocks[i].height) {
      locals.unconfirmedBlocks.splice(i, 0, block);
      break;
    }
  }
};

// insert to tx info
const insertTransactionInfos = async block => {
  // const coinbaseTxInfo = {
  //   ...block.transactions[0],
  //   blockHash: block.hash,
  //   blockHeight: block.height,
  //   status: "unconfirmed",
  // };

  // for (const transaction of block.transactions) {

  // }

  // old

  const transactionInfos = [
    {
      ...block.transactions[0],
      blockHash: block.hash,
      blockHeight: block.height,
      status: "unconfirmed",
    },
  ];

  for (let i = 1; i < block.transactions.length; i++) {
    const transaction = block.transactions[i];
    const inputs = await Promise.all(
      transaction.inputs.map(async input => {
        // might need to account for orphaned ones?
        const inputTx = (await TransactionInfo.findOne({ hash: input.txHash })) as any;
        if (!inputTx) throw Error("Fatal: inputTx not found!");

        await TransactionInfo.updateMany(
          { hash: input.txHash },
          { $set: { [`outputs.${input.outIndex}.txHash`]: transaction.hash } }
        );

        const { address, amount } = inputTx.outputs[input.outIndex];
        return { ...input, address, amount };
      })
    );
    transactionInfos.push({
      ...transaction,
      blockHash: block.hash,
      blockHeight: block.height,
      status: "unconfirmed",
      inputs,
    });
  }

  await TransactionInfo.insertMany(transactionInfos);
};

// called after head block is updated
const removeConfirmedBlocks = async locals => {
  // remove confirmed blocks from pool and add to persistent db
  const confirmedHeight = locals.headBlock.height - params.blkMaturity + 1;
  let lastBlock = locals.headBlock;
  let currentHash = locals.headBlock.previousHash;
  const orphanedBlocks = [];
  for (let i = 0; i < locals.unconfirmedBlocks.length; i++) {
    if (locals.unconfirmedBlocks[i].hash === currentHash) {
      lastBlock = locals.unconfirmedBlocks[i];
      currentHash = locals.unconfirmedBlocks[i].previousHash;
      continue;
    }
    // for orphaned blocks
    if (locals.unconfirmedBlocks[i].height === confirmedHeight)
      orphanedBlocks.push(locals.unconfirmedBlocks[i]); // confirmed orphaned
  }

  // put to orphaned blocks db
  // @ts-ignore
  await OrphanedBlock.insertMany(orphanedBlocks.map(cleanBlock));

  locals.unconfirmedBlocks = locals.unconfirmedBlocks.filter(
    block => !orphanedBlocks.includes(block)
  );

  // update tx info db orphaned
  await TransactionInfo.updateMany(
    { blockHash: { $in: orphanedBlocks.map(b => b.hash) } },
    { $set: { status: "orphaned" } }
  );

  if (lastBlock.height !== confirmedHeight)
    console.log("BAD: something is wrong w the unconfirmed blocks array!");

  // remove tx frm mempool
  await MempoolTransaction.deleteMany({
    hash: { $in: lastBlock.transactions.slice(1).map(tx => tx.hash) },
  });

  // update tx in tx infos
  await TransactionInfo.updateMany(
    { blockHash: lastBlock.hash },
    { $set: { status: "confirmed" } }
  );

  // update utxo
  const inputsDelete = [];
  const outputsInsert = [];
  for (let i = 0; i < lastBlock.transactions.length; i++) {
    inputsDelete.push(...lastBlock.transactions[i].inputs);
    for (let j = 0; j < lastBlock.transactions[i].outputs.length; j++) {
      outputsInsert.push({
        txHash: lastBlock.transactions[i].hash,
        outIndex: j,
        address: lastBlock.transactions[i].outputs[j].address,
        amount: lastBlock.transactions[i].outputs[j].amount,
      });
    }
  }

  for (const input of inputsDelete)
    await Utxo.deleteOne({ txHash: input.txHash, outIndex: input.outIndex });

  await Utxo.insertMany(outputsInsert);

  // put to best chain, mature blocks
  await MatureBlock.create(cleanBlock(lastBlock));
  locals.unconfirmedBlocks.splice(locals.unconfirmedBlocks.indexOf(lastBlock), 1);
};

const updateMempoolAndUtxos = (locals, block) => {
  for (const transaction of block.transactions) {
    // update mempool, remove txs in block frm mempool
    locals.mempool = locals.mempool.filter(tx => tx.hash !== transaction.hash);

    // remove spent utxos
    outer: for (const input of transaction.inputs) {
      for (let i = 0; i < locals.utxos.length; i++) {
        if (
          locals.utxos[i].txHash === input.txHash &&
          locals.utxos[i].outIndex === input.outIndex
        ) {
          locals.utxos.splice(i, 1);
          continue outer;
        }
      }
      // utxo does not exist
      throw Error("Fatal: Attempt to spend utxo that doesn't exist");
    }

    // insert new utxos
    for (let i = 0; i < transaction.outputs.length; i++) {
      locals.utxos.push({
        txHash: transaction.hash,
        outIndex: i,
        address: transaction.outputs[i].address,
        amount: transaction.outputs[i].amount,
      });
    }
  }
};

const recalcMempoolAndUtxos = async locals => {
  locals.utxos = await Utxo.find({}, { _id: false }).lean();
  locals.mempool = await MempoolTransaction.find({}, { _id: false }).lean();
  const bestchain = [locals.headBlock];

  let currentHash = locals.headBlock.previousHash;
  for (let i = 0; i < locals.unconfirmedBlocks.length; i++) {
    if (locals.unconfirmedBlocks[i].hash !== currentHash) continue;
    currentHash = locals.unconfirmedBlocks[i].previousHash;
    bestchain.push(locals.unconfirmedBlocks[i]);
  }

  for (let i = bestchain.length - 1; i >= 0; i--) updateMempoolAndUtxos(locals, bestchain[i]);
};

// precondition: locals.headBlock is present
const calculateDifficulty = async locals => {
  if (locals.headBlock.height === 0) return (locals.difficulty = params.initBlkDiff); // genesis
  const offset = locals.headBlock.height % params.diffRecalcHeight;

  const currRecalcHeight = locals.headBlock.height - offset;
  const prevRecalcHeight = currRecalcHeight - params.diffRecalcHeight;
  const currRecalcBlock = await getBlockByHeight(locals, currRecalcHeight);
  const prevRecalcBlock = await getBlockByHeight(locals, prevRecalcHeight); // prev block where recalc happened

  const timeDiff = (currRecalcBlock.timestamp - prevRecalcBlock.timestamp) / 1000; // divide to get seconds
  const targetTimeDiff = params.diffRecalcHeight * params.targBlkTime; // in seconds
  let correctionFactor = targetTimeDiff / timeDiff;
  correctionFactor = Math.min(correctionFactor, params.maxDiffCorrFact); // clamp correctionfactor
  correctionFactor = Math.max(correctionFactor, params.minDiffCorrFact);
  locals.difficulty =
    Math.round(
      (Math.max(currRecalcBlock.difficulty * correctionFactor, params.initBlkDiff) +
        Number.EPSILON) *
        10000
    ) / 10000; // new difficulty, max 4 decimal places

  console.log(`recalculating diff: 
  timeDiff: ${timeDiff}
  targetTimeDiff: ${targetTimeDiff}
  corrFact: ${correctionFactor}
  oldDiff: ${currRecalcBlock.difficulty}
  newDiff: ${locals.difficulty}`);
};

export const addBlock = async (locals, block, io) => {
  const validation = validateBlock(locals, block);
  if (validation.code !== RESULT.VALID) return validation;

  const previousBlock = locals.unconfirmedBlocks.find(b => b.hash === block.previousHash);
  const isNewHead = block.height === locals.headBlock.height + 1;
  const isReorg = previousBlock !== locals.headBlock;

  if (isNewHead) {
    locals.headBlock = block;
    // remove last block(s) which are now confirmed
    await removeConfirmedBlocks(locals);
  }

  insertUnconfirmedBlock(locals, block);
  await insertTransactionInfos(block);

  if (isNewHead) {
    // forked, new head block, call for reorg
    if (isReorg) await recalcMempoolAndUtxos(locals);
    else updateMempoolAndUtxos(locals, block);

    if (locals.headBlock.height % params.diffRecalcHeight === 0)
      // time to recalculate difficulty
      await calculateDifficulty(locals);
  }

  updateUnconfirmedBlocks(locals);

  // broadcast block to other nodes and all clients.
  io.emit("block", {
    headBlock: locals.headBlock,
    unconfirmedBlocks: locals.unconfirmedBlocks,
    mempool: getMempoolInfo(locals),
  });

  return validation;
};

// TODO: change to just setup local state
export const setupUnconfirmedBlocks = async locals => {
  locals.unconfirmedBlocks = await UnconfirmedBlock.find({}, { _id: false }).sort({ height: -1 });
  // choose heighest block with lowest timestamp
  const highest = locals.unconfirmedBlocks[0].height;
  let earliestBlock = locals.unconfirmedBlocks[0];
  for (const block of locals.unconfirmedBlocks) {
    if (block.height !== highest) break;
    if (earliestBlock.timestamp > block.timestamp) earliestBlock = block;
  }

  locals.headBlock = earliestBlock;
  await recalcMempoolAndUtxos(locals);
  await calculateDifficulty(locals);
};

export const updateUnconfirmedBlocks = async locals => {
  // dump unconfirmed blocks into persistent
  await UnconfirmedBlock.deleteMany();
  await UnconfirmedBlock.insertMany(locals.unconfirmedBlocks);
};

export const getBlockchainInfo = async (locals, limit, height) => {
  const maxHeight = height;
  const minHeight = height - limit; // exclusive
  const unconfirmed = locals.unconfirmedBlocks.filter(
    block => block.height <= maxHeight && block.height > minHeight
  );
  const matured = await MatureBlock.find(
    { height: { $lte: maxHeight, $gt: minHeight } },
    { _id: false }
  ).sort({ height: -1 });
  const orphaned = await OrphanedBlock.find(
    { height: { $lte: maxHeight, $gt: minHeight } },
    { _id: false }
  ).sort({ height: -1 });

  const blockchain = [
    ...unconfirmed.map(block => ({ block, status: "Unconfirmed" })),
    ...matured.map(block => ({ block, status: "Confirmed" })),
    ...orphaned.map(block => ({ block, status: "Orphaned" })),
  ].sort((a, b) => (a.block.height < b.block.height ? 1 : -1));
  return blockchain;
};

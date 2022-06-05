// @ts-nocheck
import BlockCrypto from "blockcrypto";

import params from "../params";
import Block from "../models/block.model";
import Transaction from "../models/transaction.model";
import {
  OrphanedBlock,
  MatureBlock,
  UnconfirmedBlock,
  MempoolTransaction,
  Utxo,
  TransactionInfo,
} from "../models/index";

const { createBlockchain, getHighestValidBlock, getBestChain, calculateUTXOSet, calculateMempool } =
  BlockCrypto;

export const cleanBlock = block => ({
  height: block.height,
  hash: block.hash,
  previousHash: block.previousHash,
  timestamp: block.timestamp,
  version: block.version,
  difficulty: block.difficulty,
  nonce: block.nonce,
  merkleRoot: block.merkleRoot,
  transactions: block.transactions.map(tx => ({
    hash: tx.hash,
    timestamp: tx.timestamp,
    version: tx.version,
    inputs: tx.inputs,
    outputs: tx.outputs,
  })),
});

export const resetMigration = async () => {
  await OrphanedBlock.deleteMany();
  await MatureBlock.deleteMany();
  await UnconfirmedBlock.deleteMany();
  await MempoolTransaction.deleteMany();
  await Utxo.deleteMany();
};

export const phase2 = async () => {
  const blockchain = await MatureBlock.find().sort({ height: 1 });
  const transactions = blockchain.flatMap(block => block.transactions);

  for (let i = 0; i < params.blkMaturity - 1; i++) {
    const headBlock = blockchain.pop();
    await MatureBlock.deleteOne({ _id: headBlock._id });
    await new UnconfirmedBlock(cleanBlock(headBlock)).save();
  }
  const headBlock = getHighestValidBlock(params, blockchain);
  const utxos = calculateUTXOSet(blockchain, headBlock);
  const mempool = calculateMempool(blockchain, headBlock, transactions);

  await MempoolTransaction.insertMany(mempool);
  await Utxo.insertMany(utxos);
};

export const phase1 = async () => {
  let blockchain = createBlockchain(await Block.find({}, { _id: false }).populate("transactions"));
  let bestchain = getBestChain(params, blockchain);

  const orphanedBlocks = blockchain.filter(block => !bestchain.some(b => b.hash === block.hash));
  await OrphanedBlock.insertMany(orphanedBlocks.map(cleanBlock));
  await MatureBlock.insertMany(bestchain.map(cleanBlock));
};

const matureTxInfo = async () => {
  // construct tx infos from mature blocks
  const matureBlocks = await MatureBlock.find({}, { _id: false });
  let transactionInfos = [];
  for (const block of matureBlocks) {
    for (const transaction of block.transactions) {
      const transactionInfo = {
        hash: transaction.hash,
        timestamp: transaction.timestamp,
        version: transaction.version,
        blockHash: block.hash,
        blockHeight: block.height,
        status: "confirmed",
        inputs: await Promise.all(
          transaction.inputs.map(async input => {
            const inputTx = (
              await MatureBlock.findOne(
                { "transactions.hash": input.txHash },
                { "transactions.$": 1 }
              )
            )?.transactions[0];
            if (!inputTx) throw Error("bad transaction " + transaction.hash);
            const { address, amount } = inputTx.outputs[input.outIndex];
            return {
              txHash: input.txHash,
              outIndex: input.outIndex,
              publicKey: input.publicKey,
              signature: input.signature,
              address,
              amount,
            };
          })
        ),
        outputs: await Promise.all(
          transaction.outputs.map(async (output, index) => {
            const outputTx = (
              await MatureBlock.findOne(
                {
                  "transactions.inputs": {
                    $elemMatch: { txHash: transaction.hash, outIndex: index },
                  },
                },
                { "transactions.$": 1 }
              )
            )?.transactions[0];
            return {
              address: output.address,
              amount: output.amount,
              txHash: outputTx?.hash,
            };
          })
        ),
      };
      transactionInfos.push(transactionInfo);
    }
  }

  await TransactionInfo.insertMany(transactionInfos);
};

const orphanedTxInfo = async () => {
  const orphanedBlocks = await OrphanedBlock.find({}, { _id: false });
  let transactionInfos = [];
  for (const block of orphanedBlocks) {
    for (const transaction of block.transactions) {
      const transactionInfo = {
        hash: transaction.hash,
        timestamp: transaction.timestamp,
        version: transaction.version,
        blockHash: block.hash,
        blockHeight: block.height,
        status: "orphaned",
        inputs: await Promise.all(
          transaction.inputs.map(async input => {
            const inputTx = (
              await MatureBlock.findOne(
                { "transactions.hash": input.txHash },
                { "transactions.$": 1 }
              )
            )?.transactions[0];
            if (!inputTx) throw Error("bad transaction: " + transaction.hash);
            const { address, amount } = inputTx.outputs[input.outIndex];
            return {
              txHash: input.txHash,
              outIndex: input.outIndex,
              publicKey: input.publicKey,
              signature: input.signature,
              address,
              amount,
            };
          })
        ),
        outputs: await Promise.all(
          transaction.outputs.map(async (output, index) => {
            const outputTx = (
              await MatureBlock.findOne(
                {
                  "transactions.inputs": {
                    $elemMatch: { txHash: transaction.hash, outIndex: index },
                  },
                },
                { "transactions.$": 1 }
              )
            )?.transactions[0];
            return {
              address: output.address,
              amount: output.amount,
              txHash: outputTx?.hash,
            };
          })
        ),
      };
      transactionInfos.push(transactionInfo);
    }
  }

  await TransactionInfo.insertMany(transactionInfos);
};

const unconfirmedTxInfo = async () => {
  const unconfirmedBlocks = await UnconfirmedBlock.find({}, { _id: false }).lean();
  const txInfos = [];
  for (const block of unconfirmedBlocks) {
    for (const transaction of block.transactions) {
      const inputs = await Promise.all(
        transaction.inputs.map(async input => {
          let inputTx = await TransactionInfo.findOne({ hash: input.txHash });
          if (!inputTx)
            inputTx = (
              await UnconfirmedBlock.findOne(
                { "transactions.hash": input.txHash },
                { "transactions.$": 1 }
              )
            )?.transactions[0];

          if (!inputTx) throw Error("bad transaction: " + transaction.hash);
          const { address, amount } = inputTx.outputs[input.outIndex];
          return { ...input, address, amount };
        })
      );
      const outputs = await Promise.all(
        transaction.outputs.map(async (output, index) => {
          const outputTx = (
            await UnconfirmedBlock.findOne(
              {
                "transactions.inputs": {
                  $elemMatch: { txHash: transaction.hash, outIndex: index },
                },
              },
              { "transactions.$": 1 }
            )
          )?.transactions?.[0];
          return { ...output, txHash: outputTx?.hash };
        })
      );
      txInfos.push({
        ...transaction,
        blockHash: block.hash,
        blockHeight: block.height,
        status: "unconfirmed",
        inputs,
        outputs,
      });
    }
  }
  await TransactionInfo.insertMany(txInfos);
};

const outputTxInfo = async () => {
  const txInfos = await TransactionInfo.find({}, { _id: false }).lean();
  for (const transaction of txInfos) {
    for (let i = 0; i < transaction.outputs.length; i++) {
      const spendingTx = await TransactionInfo.findOne({
        inputs: { $elemMatch: { txHash: transaction.hash, outIndex: i } },
      });

      if (!spendingTx) continue;
      await TransactionInfo.updateOne(
        { hash: transaction.hash, blockHash: transaction.blockHash },
        { $set: { [`outputs.${i}.txHash`]: spendingTx.hash } }
      );
    }
  }
};

// build tx info table from all blocks (mature, orphaned, unconfirmed)
export const phase3 = async () => {
  await TransactionInfo.deleteMany();
  await matureTxInfo();
  await orphanedTxInfo();
  await unconfirmedTxInfo();
  await outputTxInfo();
};

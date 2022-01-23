import BlockCrypto from "blockcrypto";

import params from "../params";

import { validateCandidateBlock } from "./blockcrypto";

const {
  createOutput,
  calculateBlockReward,
  createTransaction,
  calculateTransactionHash,
  calculateHashTarget,
  bigIntToHex64,
  calculateMerkleRoot,
  mineGenesisBlock,
  RESULT,
} = BlockCrypto;

export const getMiningInfo = locals => ({
  headBlock: locals.headBlock,
  mempool: locals.mempool,
  unconfirmedBlocks: locals.unconfirmedBlocks,
});

export const createCandidateBlock = async (locals, previousBlock, transactions = [], miner) => {
  let totalInput = 0;
  let totalOutput = 0;
  const utxos = [...locals.utxos];
  for (const transaction of transactions) {
    for (const input of transaction.inputs) {
      const utxo = utxos.find(
        utxo => utxo.txHash === input.txHash && utxo.outIndex === input.outIndex
      );
      totalInput += utxo?.amount ?? 0; // utxo may be null, in that case it should fail when validating
    }

    for (let i = 0; i < transaction.outputs.length; i++) {
      const output = transaction.outputs[i];
      totalOutput += output.amount;
      utxos.push({
        txHash: transaction.hash,
        outIndex: i,
        address: output.address,
        amount: output.amount,
      });
    }
  }

  const fees = Math.max(totalInput - totalOutput, 0);
  const output = createOutput(miner, calculateBlockReward(params, previousBlock.height + 1) + fees);
  const coinbase = createTransaction(params, [], [output]);
  coinbase.hash = calculateTransactionHash(coinbase);
  const block = createBlock(params, previousBlock, [coinbase, ...transactions], locals.difficulty);
  const target = bigIntToHex64(calculateHashTarget(params, block));

  const validation = validateCandidateBlock(locals, block);
  return { block, target, validation };
};

const createBlock = (params, previousBlock, transactions, difficulty) => ({
  height: previousBlock.height + 1,
  previousHash: previousBlock.hash,
  transactions,
  timestamp: Date.now(),
  version: params.version,
  difficulty,
  merkleRoot: calculateMerkleRoot(transactions.map(tx => tx.hash)),
  nonce: 0,
});

export const mineGenesis = async address => {
  const output = createOutput(address, params.initBlkReward);
  const coinbase = createTransaction(params, [], [output]);
  coinbase.hash = calculateTransactionHash(coinbase);
  const genesis = mineGenesisBlock(params, [coinbase]);

  // await addBlock(genesis);
  return genesis;
};

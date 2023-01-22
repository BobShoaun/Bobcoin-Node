import { createOutput, createInput, createTransaction, calculateTransactionHash, signTransaction } from "blockcrypto";

import params from "../params";
import { poolSecretKey, poolPublicKey, poolAddress, poolOperatorFeePercent } from "../config";
import { getHeadBlock } from "./blockchain.controller";
import { addTransaction } from "./transaction.controller";
import { getValidMempool } from "./mempool.controller";
import { PoolMiners, PoolRewards, BlocksInfo } from "../models";
import { VCODE } from "../helpers/validation-codes";

export const distributeConfirmedPoolRewards = async (req, res, next) => {
  const headBlock = await getHeadBlock();

  const confirmedHeight = headBlock.height - params.blkMaturity - 1;
  const confirmedPoolRewards = await PoolRewards.find({
    blockHeight: { $lte: confirmedHeight },
  }).lean();

  for (const { blockHeight, blockHash, minerShares } of confirmedPoolRewards) {
    const blockInfo = await BlocksInfo.findOne({ hash: blockHash }, "-_id valid transactions").lean();

    if (!blockInfo?.valid) {
      // dump shares back into poolminers entry
      for (const { address, numShares } of minerShares)
        await PoolMiners.updateOne({ address }, { $inc: { numShares } });

      continue;
    }

    // create and release tx rewards
    const txHash = blockInfo.transactions[0].hash;
    const input = createInput(txHash, 0, poolPublicKey);

    const totalRewards = blockInfo.transactions[0].outputs[0].amount;
    const totalShares = minerShares.reduce((total, miner) => total + miner.numShares, 0);

    const operatorFee = Math.ceil(totalRewards * poolOperatorFeePercent);
    const operatorOutput = createOutput(poolAddress, operatorFee);
    const distributionRewards = totalRewards - operatorFee;

    const distributionOutputs = minerShares.map(({ address, numShares }) =>
      createOutput(address, Math.floor(distributionRewards * (numShares / totalShares)))
    );
    const transaction = createTransaction(
      params,
      [input],
      [operatorOutput, ...distributionOutputs],
      `Reward distribution for block ${blockHeight}:${blockHash}`
    );
    const signature = signTransaction(transaction, poolSecretKey);
    transaction.inputs.forEach(input => (input.signature = signature));
    transaction.hash = calculateTransactionHash(transaction);

    const validation = await addTransaction(transaction);
    if (validation.code !== VCODE.VALID) return res.status(500).send(validation);
  }
  await PoolRewards.deleteMany({ blockHeight: { $lte: confirmedHeight } });

  req.app.locals.io.emit("transaction", {
    mempool: await getValidMempool(),
  });
  next();
};

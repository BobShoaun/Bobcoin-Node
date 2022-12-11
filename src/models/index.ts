import { model, Document } from "mongoose";
import { Block, BlockInfo, Utxo, Transaction, FaucetEntry, PoolMiner, PoolReward } from "./types";

import blockSchema from "./block.model";
import blockInfoSchema from "./blockInfo.model";
import utxoSchema from "./utxo.model";
import transactionSchema from "./transaction.model";
import faucetEntrySchema from "./faucetEntry.model";
import poolMinerSchema from "./poolMiner.model";
import poolRewardSchema from "./poolReward.model";

type BlockDoc = Block & Document;
type BlockInfoDoc = BlockInfo & Document;
type UtxoDoc = Utxo & Document;
type MempoolDoc = Transaction & Document;
type FaucetEntryDoc = FaucetEntry & Document;
type PoolMinerDoc = PoolMiner & Document;
type PoolRewardDoc = PoolReward & Document;

export const Blocks = model<BlockDoc>("blocks", blockSchema);
export const BlocksInfo = model<BlockInfoDoc>("blocks info", blockInfoSchema);
export const Utxos = model<UtxoDoc>("utxos", utxoSchema);
export const Mempool = model<MempoolDoc>("mempool transactions", transactionSchema);
export const FaucetEntries = model<FaucetEntryDoc>("faucet entries", faucetEntrySchema);
export const PoolMiners = model<PoolMinerDoc>("pool miners", poolMinerSchema);
export const PoolRewards = model<PoolRewardDoc>("pool rewards", poolRewardSchema);

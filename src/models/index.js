import mongoose from "mongoose";
import blockSchema from "./block2.model.js";
import transactionSchema from "./transaction2.model.js";
import matureBlockSchema from "./matureBlock.model.js";
import utxoSchema from "./utxo.model.js";

export const MatureBlock = mongoose.model("mature blocks", matureBlockSchema);
export const OrphanedBlock = mongoose.model("orphaned blocks", blockSchema);
export const UnconfirmedBlock = mongoose.model("unconfirmed blocks", blockSchema);
export const MempoolTransaction = mongoose.model("mempool transactions", transactionSchema);
export const Utxo = mongoose.model("utxos", utxoSchema);

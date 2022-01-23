import mongoose from "mongoose";
import blockSchema from "./block2.model";
import transactionSchema from "./transaction2.model";
import matureBlockSchema from "./matureBlock.model";
import utxoSchema from "./utxo.model";
import transactionInfoSchema from "./transactionInfo.model";
import faucetEntrySchema from "./faucetEntry.model";

export const MatureBlock = mongoose.model("mature blocks", matureBlockSchema);
export const OrphanedBlock = mongoose.model("orphaned blocks", blockSchema);
export const UnconfirmedBlock = mongoose.model("unconfirmed blocks", blockSchema);
export const MempoolTransaction = mongoose.model("mempool transactions", transactionSchema);
export const Utxo = mongoose.model("utxos", utxoSchema);
export const TransactionInfo = mongoose.model("transactions info", transactionInfoSchema);
export const FaucetEntry = mongoose.model("faucet entry", faucetEntrySchema);

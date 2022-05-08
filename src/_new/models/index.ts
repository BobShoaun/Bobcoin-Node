// @ts-nocheck
import { model } from "mongoose";

import blockSchema from "./block.model";
import blockInfoSchema from "./blockInfo.model";
import utxoSchema from "./utxo.model";

export const Blocks = model("blocks", blockSchema);
export const BlocksInfo = model("blocks info", blockInfoSchema);
export const Utxos = model("utxos", utxoSchema);
// export const HeadBlock = model("head block", blockInfoSchema);

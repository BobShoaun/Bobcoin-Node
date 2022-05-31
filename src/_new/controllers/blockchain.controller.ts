import { Blocks, BlocksInfo, Utxos } from "../models";
import { Block } from "../models/types";

export const getHeadBlock = async () =>
  (await BlocksInfo.find({ valid: true }, { _id: 0 }).sort({ height: -1 }).limit(1))[0];

// @ts-nocheck
import mongoose from "mongoose";

import blockSchema from "./block.model";

export const Block = mongoose.model("blocks", blockSchema);

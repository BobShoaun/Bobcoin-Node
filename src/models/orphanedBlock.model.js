import mongoose from "mongoose";
import { blockSchema } from "./block.model.js";

const OrphanedBlock = mongoose.model("orphaned blocks", blockSchema);
export default OrphanedBlock;

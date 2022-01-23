import mongoose from "mongoose";
import { atlasURI, network } from "../config.js";
import {
  OrphanedBlock,
  MatureBlock,
  UnconfirmedBlock,
  MempoolTransaction,
} from "../models/index.js";
import fs from "fs";

const filePath = process.argv[2] ?? "./output.json";

(async function () {
  await mongoose.connect(atlasURI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  });
  console.log("MongoDB database connection established to: ", network);

  const matureBlocks = await MatureBlock.find();
  const unconfirmedBlocks = await UnconfirmedBlock.find();
  const orphanedBlocks = await OrphanedBlock.find();
  const mempool = await MempoolTransaction.find();
  mongoose.connection.close();

  const blocks = [...matureBlocks, ...unconfirmedBlocks, ...orphanedBlocks];
  blocks.sort((a, b) => a.height - b.height);
  const data = { blocks, mempool };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log("dumped", blocks.length, "blocks into file");
})();

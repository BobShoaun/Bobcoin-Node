// @ts-nocheck
import mongoose from "mongoose";
import { mongoURI, network } from "../config";
import { Blocks, Mempool } from "../models";
import fs from "fs";

const filePath = process.argv[2] ?? "./output.json";

(async function () {
  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  });
  console.log("MongoDB database connection established to:", network);

  const blocks = await Blocks.find({}, { _id: false }).sort({ height: -1 });
  const mempool = await Mempool.find({}, { _id: false });

  mongoose.connection.close();

  const data = { blocks, mempool };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log("dumped", blocks.length, "blocks into file");
})();

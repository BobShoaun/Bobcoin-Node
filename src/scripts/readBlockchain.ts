import { readFile } from "fs/promises";
import mongoose from "mongoose";
import { mongoURI, network } from "../config";
import { Blocks, Mempool } from "../models";

import { VCODE } from "../helpers/validation-codes";
import { validateBlockchain } from "../controllers/validation.controller";

(async function () {
  const filePath = process.argv[2] ?? "./output.json";
  const { blocks, mempool } = JSON.parse((await readFile(filePath)).toString());

  // console.log(mempool);

  const validation = validateBlockchain(blocks);
  console.log(validation.code === VCODE.VALID ? "Blockchain is valid" : "Blockchain is invalid!!!");

  process.exit();

  // add to db
  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  });
  console.log("MongoDB database connection established to:", network);

  await Blocks.deleteMany();
  await Blocks.insertMany(blocks);

  await Mempool.deleteMany();
  await Mempool.insertMany(mempool);

  mongoose.connection.close();
  console.log("updated db with blocks");
})();

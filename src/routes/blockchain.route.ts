import { Router } from "express";
import { Blocks, Mempool } from "../models";
import { validateBlockchain } from "../controllers/validation.controller";
import { VCODE } from "../helpers/validation-codes";
import { Block } from "../models/types";

const router = Router();

router.get("/blockchain/validate", async (req, res) => {
  const blocks = (await Blocks.find({}, { _id: 0 }).lean()) as Block[];

  const validation = validateBlockchain(blocks);
  if (validation.code === VCODE.VALID) return res.status(200).send(validation);
  return res.status(500).send(validation);
});

export default router;

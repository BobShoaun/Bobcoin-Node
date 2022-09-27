import { Router } from "express";
import { Blocks, Mempool } from "../models";
import { validateBlockchain } from "../controllers/validation.controller";
import { VCODE } from "../helpers/validation-codes";
import { Block } from "../models/types";
import { authorizeUser } from "../middlewares/authentication.middleware";

const router = Router();

router.get("/blockchain/validate", authorizeUser, async (req, res) => {
  const blocks = (await Blocks.find({}, { _id: 0 }).lean()) as Block[];

  const validation = validateBlockchain(blocks);
  if (validation.code === VCODE.VALID) return res.status(200).send(validation);
  return res.status(500).send(validation);
});

router.post("/blockchain/sync", authorizeUser, async (req, res) => {});

router.get("/blockchain/test", async (req, res) => {
  req.app.locals.io.emit("node-block", {
    hello: "world",
    hash: "fdsfsdfsdf",
  });
  return res.status(200).send("FUCK UUUU");
});

export default router;

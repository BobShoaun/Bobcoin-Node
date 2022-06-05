import { Router } from "express";
import { FaucetEntries } from "../models";
import { isBefore, sub } from "date-fns";

import params from "../params";
// import BlockCrypto from "blockcrypto";

import {
  recaptchaSecretKey,
  faucetDonateAmount,
  faucetFeeAmount,
  faucetSecretKey,
  faucetCooldown,
} from "../config";
// import { addTransaction } from "../middlewares/transaction.middleware";
import axios from "axios";

const router = Router();

router.get("/faucet/info", (req, res) => {});

export default router;

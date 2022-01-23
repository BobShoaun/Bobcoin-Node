import Express from "express";
import { getUtxos, getMempoolUtxos } from "../controllers/utxo.controller";

export const utxoRouter = () => {
  const router = Express.Router();

  router.get("/:address", (req, res) => {
    const block = req.query.block;
    const address = req.params.address;
    const utxos = getUtxos(req.app.locals, address);
    res.send(utxos);
  });

  // get utxos excluding those in mempool
  router.get("/mempool/:address", (req, res) => {
    const address = req.params.address;
    const utxos = getMempoolUtxos(req.app.locals, address);
    res.send(utxos);
  });

  return router;
};

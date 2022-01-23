import Express from "express";

import params from "../params";

export const consensusRouter = () => {
  const router = Express.Router();

  router.get("/", async (req, res) => {
    res.send(params);
  });

  return router;
};

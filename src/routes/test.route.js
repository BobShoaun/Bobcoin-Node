import Express from "express";

import { testDifficulty } from "../controllers/test.controller.js";

export const testRouter = () => {
  const router = Express.Router();

  const error = (res, e) => {
    res.status(400).json(`${e}`);
    console.log(e);
  };

  // router.get("/difficulty", async (req, res) => {
  //   try {
  //     res.send(await testDifficulty(req.app.locals));
  //   } catch (e) {
  //     error(res, e);
  //   }
  // });

  return router;
};

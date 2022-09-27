import { apiKey } from "../config";

export const authorizeUser = async (req, res, next) => {
  const _apiKey = req.headers.authorization?.split(" ")[1];
  if (!_apiKey) return res.sendStatus(401); // unauthorized
  if (_apiKey !== apiKey) return res.sendStatus(401); // unauthorized
  next();
};

export const handlerErrors = (err, req, res, next) => {
  res.sendStatus(500); // catch all for all uncaught errors
};

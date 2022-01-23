export const handlerErrors = (err, req, res, next) => {
  console.log("Caught in general hander:", err);
  res.sendStatus(500); // catch all for all uncaught errors
};

function errorHandler(error, req, res, next) {
  console.error(error);

  return res.status(500).json({ error: "Something went wrong" });
}

module.exports = errorHandler;

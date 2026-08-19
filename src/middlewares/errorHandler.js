function errorHandler(error, req, res, next) {
  console.error(error);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Image must be 5MB or smaller." });
  }

  if (error.message === "Only image files are allowed") {
    return res.status(400).json({ error: "Only image files are allowed." });
  }

  return res.status(500).json({ error: "Something went wrong" });
}

module.exports = errorHandler;

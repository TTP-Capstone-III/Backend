const express = require("express");
const { db } = require("./models");

const app = express();
const PORT = Number(process.env.PORT) || 5050;

app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

async function startServer() {
  try {
    await db.authenticate();
    console.log("Database connected");

    await db.sync();
    console.log("Models synced");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error);
    process.exit(1);
  }
}

startServer();

module.exports = app;

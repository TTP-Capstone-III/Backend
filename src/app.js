const cors = require("cors");
const express = require("express");
const cookieParser = require("cookie-parser"); //request.cookies.session
const { db } = require("./models");

const authRouter = require("./routes/authRoute");
const reservationRouter = require("./routes/reservationRoutes");
const hostRouter = require("./routes/hostRoutes");
const listingRouter = require("./routes/listingRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const PORT = Number(process.env.PORT) || 5050;

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/reservations", reservationRouter);
app.use("/api/host", hostRouter);
app.use("/api/listings", listingRouter);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use(errorHandler);

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

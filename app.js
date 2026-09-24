require("dotenv").config();

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const mongoose = require("mongoose");

const indexRouter = require("./routes/index");
const adminRouter = require("./routes/admin");

const app = express();
const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

if (!sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set in production.");
}

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev", { skip: (req) => req.path.startsWith("/admin/reset-password/") }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  name: "nishat.sid",
  secret: sessionSecret || "local-development-session-secret-change-me",
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nishat_college" }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000,
  },
}));
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/admin", adminRouter);

app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

// The server waits for this promise before accepting requests.
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nishat_college";
app.locals.databaseReady = mongoose.connect(mongoUri)
  .then(() => console.log("Connected to MongoDB"));

module.exports = app;

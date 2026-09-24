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
const isProduction = process.env.NODE_ENV === "production";
if (isProduction) app.set("trust proxy", 1);

if (isProduction) {
  const requiredEnv = ["MONGO_URI", "SESSION_SECRET", "APP_BASE_URL", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  if (sessionSecret.length < 32 || /change-me|replace-this/i.test(sessionSecret)) {
    throw new Error("SESSION_SECRET must be a unique random value of at least 32 characters in production.");
  }

  let publicUrl;
  try { publicUrl = new URL(process.env.APP_BASE_URL); } catch { throw new Error("APP_BASE_URL must be a valid public HTTPS URL."); }
  if (publicUrl.protocol !== "https:" || /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(publicUrl.host) || publicUrl.username || publicUrl.password) {
    throw new Error("APP_BASE_URL must use HTTPS and a public hostname in production.");
  }
  if (/localhost|127\.0\.0\.1/i.test(process.env.MONGO_URI)) {
    throw new Error("MONGO_URI must point to the production database, not localhost.");
  }
  if (/example\.com/i.test(`${process.env.SMTP_HOST} ${process.env.SMTP_FROM}`)) {
    throw new Error("Replace example SMTP settings before starting in production.");
  }
}

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.disable("x-powered-by");

app.use((req, res, next) => {
  const configuredOrigin = process.env.APP_BASE_URL;
  res.locals.siteOrigin = (configuredOrigin || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("X-Frame-Options", "DENY");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProduction) res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(logger("dev", { skip: (req) => req.path.startsWith("/admin/reset-password/") }));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
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
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/admin", adminRouter);

app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => {
  res.locals.message = isProduction
    ? (err.status === 404 ? "We couldn’t find that page." : "The page could not be loaded right now.")
    : err.message;
  res.locals.error = req.app.get("env") === "development" ? err : null;
  res.locals.status = err.status || 500;
  res.status(err.status || 500);
  res.render("error");
});

// The server waits for this promise before accepting requests.
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nishat_college";
app.locals.databaseReady = mongoose.connect(mongoUri)
  .then(() => console.log("Connected to MongoDB"));

module.exports = app;

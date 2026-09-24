require("dotenv").config();

const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");

async function main() {
  if (process.env.NODE_ENV === "production" && (!process.env.MONGO_URI || /localhost|127\.0\.0\.1/i.test(process.env.MONGO_URI))) {
    throw new Error("Set MONGO_URI to the production database before creating an administrator.");
  }
  const rl = readline.createInterface({ input, output });
  try {
    const name = (await rl.question("Admin name: ")).trim();
    const email = (await rl.question("Admin email: ")).trim().toLowerCase();
    const password = await rl.question("Admin password (minimum 12 characters): ");
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
      throw new Error("Provide a name, valid email, and password of at least 12 characters.");
    }

    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nishat_college");
    const existing = await User.findOne({ email });
    if (existing) throw new Error("A user with that email already exists.");

    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({ name, email, password: hashedPassword, role: "admin" });
    console.log(`Admin account created for ${email}.`);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

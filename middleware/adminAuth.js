const mongoose = require("mongoose");
const User = require("../models/User");

module.exports = async function adminAuth(req, res, next) {
  const admin = req.session && req.session.admin;

  if (!admin) {
    return res.redirect("/admin/login");
  }

  if (admin.role !== "admin") {
    return res.status(403).send("Forbidden");
  }

  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  if (!mongoose.isValidObjectId(admin.id)) return res.redirect("/admin/logout");
  try {
    const stillAdmin = await User.exists({ _id: admin.id, role: "admin" });
    if (!stillAdmin) return res.redirect("/admin/logout");
    return next();
  } catch (error) {
    return next(error);
  }
};

const mongoose = require("mongoose");

const siteSettingsSchema = new mongoose.Schema({
  key: { type: String, default: "public", unique: true },
  phone: { type: String, required: true, trim: true, maxlength: 40 },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
}, { timestamps: true });

module.exports = mongoose.model("SiteSettings", siteSettingsSchema);

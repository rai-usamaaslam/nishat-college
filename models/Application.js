const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true, maxlength: 120 },
  fatherName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  cnic: { type: String, required: true, trim: true, maxlength: 15, match: /^\d{5}-?\d{7}-?\d$/ },
  dob: { type: Date, required: true },
  gender: { type: String, required: true, enum: ["Female", "Male", "Other"] },
  address: { type: String, required: true, trim: true, maxlength: 1000 },
  qualification: { type: String, required: true, trim: true, maxlength: 160 },
  marks: { type: Number, required: true, min: 0 },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected"],
    default: "Pending",
  },
}, { timestamps: true });

module.exports = mongoose.model("Application", applicationSchema);

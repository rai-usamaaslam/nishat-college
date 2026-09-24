const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true },
  fatherName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  cnic: { type: String, required: true, trim: true },
  dob: { type: Date, required: true },
  gender: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  qualification: { type: String, required: true, trim: true },
  marks: { type: Number, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected"],
    default: "Pending",
  },
}, { timestamps: true });

module.exports = mongoose.model("Application", applicationSchema);

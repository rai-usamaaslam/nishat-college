const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    shortDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },

    description: {
      type: String,
      required: true,
      maxlength: 20000,
    },

    duration: {
      type: String,
      required: true,
      maxlength: 60,
    },

    eligibility: {
      type: String,
      required: true,
      maxlength: 500,
    },

    fee: {
      type: Number,
      required: true,
      min: 0,
    },

    image: {
      type: String,
      default: "",
      maxlength: 2048,
      validate: {
        validator: (value) => !value || (value.startsWith("/") && !value.startsWith("//")) || /^https:\/\//i.test(value),
        message: "Course images must use an HTTPS URL or a same-site path.",
      },
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Course", courseSchema);

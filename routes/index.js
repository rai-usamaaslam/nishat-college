const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Course = require("../models/Course");
const Announcement = require("../models/Announcement");
const Application = require("../models/Application");
const User = require("../models/User");
const nodemailer = require("nodemailer");

function renderContact(res, { error = null, message = null, values = {} } = {}, status = 200) {
  return res.status(status).render("contact", { title: "Contact | Nishat Institute of Medical Science and Technology", error, message, values });
}

router.get("/", async (req, res, next) => {
  try {
    const [courses, announcements] = await Promise.all([
      Course.find({ status: "active" }).sort({ createdAt: -1 }).lean(),
      Announcement.find({ status: "published" }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    return res.render("index", { title: "Nishat Institute of Medical Science and Technology", courses, announcements });
  } catch (error) { return next(error); }
});

router.get("/about", (req, res) => res.render("about", { title: "About | Nishat Institute of Medical Science and Technology" }));

router.get("/courses", async (req, res, next) => {
  try {
    const courses = await Course.find({ status: "active" }).sort({ createdAt: -1 }).lean();
    return res.render("programs", { title: "Our Programs | Nishat Institute of Medical Science and Technology", courses });
  } catch (error) { return next(error); }
});

router.get("/announcements", async (req, res, next) => {
  try {
    const announcements = await Announcement.find({ status: "published" }).sort({ createdAt: -1 }).lean();
    return res.render("announcements", { title: "Announcements | Nishat Institute of Medical Science and Technology", announcements });
  } catch (error) { return next(error); }
});

router.get("/contact", (req, res) => renderContact(res));

router.post("/contact", async (req, res, next) => {
  const values = {
    name: String(req.body.name || "").trim().slice(0, 120),
    email: String(req.body.email || "").trim().slice(0, 254),
    subject: String(req.body.subject || "").trim().replace(/[\r\n]+/g, " ").slice(0, 160),
    message: String(req.body.message || "").trim().slice(0, 3000),
  };
  if (!values.name || !/^\S+@\S+\.\S+$/.test(values.email) || !values.subject || !values.message) {
    return renderContact(res, { error: "Complete each field and enter a valid email address.", values }, 400);
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!smtpHost || !smtpUser || !smtpPassword || !from) {
    return renderContact(res, { error: "The contact form is temporarily unavailable. Please try again later.", values }, 503);
  }

  let transport;
  try {
    const admins = await User.find({ role: "admin" }).select("email").lean();
    if (!admins.length) return renderContact(res, { error: "The contact form is temporarily unavailable. Please try again later.", values }, 503);
    transport = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPassword },
    });
    await transport.sendMail({
      from, to: admins.map((admin) => admin.email), replyTo: { name: values.name, address: values.email },
      subject: `Website contact: ${values.subject}`,
      text: `From: ${values.name}\nEmail: ${values.email}\n\n${values.message}`,
    });
    return renderContact(res, { message: "Your message has been sent. Thank you for contacting us." });
  } catch (error) {
    return next(error);
  } finally {
    if (transport) transport.close();
  }
});

router.get("/courses/:id", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next();
  try {
    const course = await Course.findOne({ _id: req.params.id, status: "active" }).lean();
    if (!course) return next();
    return res.render("course-detail", { title: `${course.title} | Nishat Institute of Medical Science and Technology`, course });
  } catch (error) { return next(error); }
});

router.get("/apply/:courseId", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.courseId)) return next();
  try {
    const course = await Course.findOne({ _id: req.params.courseId, status: "active" }).lean();
    if (!course) return next();
    return res.render("application-form", { title: `Apply for ${course.title}`, course, error: null, values: {} });
  } catch (error) { return next(error); }
});

router.post("/apply/:courseId", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.courseId)) return next();
  try {
    const course = await Course.findOne({ _id: req.params.courseId, status: "active" }).lean();
    if (!course) return next();
    const values = {
      studentName: String(req.body.studentName || "").trim(),
      fatherName: String(req.body.fatherName || "").trim(),
      email: String(req.body.email || "").trim().toLowerCase(),
      phone: String(req.body.phone || "").trim(),
      cnic: String(req.body.cnic || "").trim(),
      dob: req.body.dob,
      gender: String(req.body.gender || "").trim(),
      address: String(req.body.address || "").trim(),
      qualification: String(req.body.qualification || "").trim(),
      marks: Number(req.body.marks),
      course: course._id,
    };
    const missing = [values.studentName, values.fatherName, values.email, values.phone, values.cnic,
      values.dob, values.gender, values.address, values.qualification].some((item) => !item);
    if (missing || !/^\S+@\S+\.\S+$/.test(values.email) || !Number.isFinite(values.marks) || values.marks < 0) {
      return res.status(400).render("application-form", {
        title: `Apply for ${course.title}`, course, values,
        error: "Complete every field using a valid email address and marks value.",
      });
    }
    const application = await Application.create(values);
    return res.render("application-success", { title: "Application received", application, course });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).render("application-form", {
        title: "Application", course: await Course.findById(req.params.courseId).lean(), values: req.body,
        error: "Check the information and try again.",
      });
    }
    return next(error);
  }
});

module.exports = router;

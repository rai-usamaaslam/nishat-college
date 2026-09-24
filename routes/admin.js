const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const createError = require("http-errors");
const router = express.Router();

const User = require("../models/User");
const Course = require("../models/Course");
const Application = require("../models/Application");
const Announcement = require("../models/Announcement");
const adminAuth = require("../middleware/adminAuth");

const title = (page) => `${page} | Nishat Institute of Medical Science and Technology`;
const hasAdminSession = (req) => Boolean(req.session?.admin?.role === "admin");
const validId = (id) => /^[a-f\d]{24}$/i.test(id);
const emailPattern = /^\S+@\S+\.\S+$/;

function renderLogin(res, error, status = 200) {
  return res.status(status).render("admin/login", { title: title("Admin Login"), error, resetSuccess: false });
}

function courseValues(body) {
  return {
    title: String(body.title || "").trim(),
    shortDescription: String(body.shortDescription || "").trim(),
    description: String(body.description || "").trim(),
    duration: String(body.duration || "").trim(),
    eligibility: String(body.eligibility || "").trim(),
    fee: Number(body.fee),
    image: String(body.image || "").trim(),
    status: body.status === "inactive" ? "inactive" : "active",
  };
}

function announcementValues(body) {
  return {
    title: String(body.title || "").trim(),
    description: String(body.description || "").trim(),
    status: body.status === "unpublished" ? "unpublished" : "published",
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

router.get("/", (req, res) => res.redirect(hasAdminSession(req) ? "/admin/dashboard" : "/admin/login"));
router.get("/login", (req, res) => {
  if (hasAdminSession(req)) return res.redirect("/admin/dashboard");
  return res.render("admin/login", { title: title("Admin Login"), error: null, resetSuccess: req.query.reset === "success" });
});

router.post("/login", asyncRoute(async (req, res, next) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!email || !password) return renderLogin(res, "Enter your email and password.", 400);

  const user = await User.findOne({ email, role: "admin" }).select("name email password role");
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return renderLogin(res, "Email or password is incorrect.", 401);
  }

  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.admin = { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
    req.session.save((saveError) => saveError ? next(saveError) : res.redirect("/admin/dashboard"));
  });
}));

router.get("/forgot-password", (req, res) => res.render("admin/forgot-password", {
  title: title("Reset Password"), error: null, message: null,
}));

router.post("/forgot-password", asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!emailPattern.test(email)) return res.status(400).render("admin/forgot-password", {
    title: title("Reset Password"), error: "Enter a valid email address.", message: null,
  });

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  const baseUrl = process.env.APP_BASE_URL || (process.env.NODE_ENV === "production" ? "" : `${req.protocol}://${req.get("host")}`);
  if (!smtpHost || !smtpUser || !smtpPassword || !from || !baseUrl) {
    return res.status(503).render("admin/forgot-password", {
      title: title("Reset Password"), error: "Password reset email is not configured. Contact the site administrator.", message: null,
    });
  }

  const user = await User.findOne({ email, role: "admin" });
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const resetUrl = `${baseUrl.replace(/\/$/, "")}/admin/reset-password/${rawToken}`;
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPassword },
    });
    try {
      await transport.sendMail({
        from,
        to: user.email,
        subject: "Nishat Institute of Medical Science and Technology admin password reset",
        text: `A password reset was requested for your administrator account. This link expires in 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      });
    } catch (error) {
      await User.updateOne({ _id: user._id }, { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } });
      throw error;
    } finally {
      transport.close();
    }
  }

  return res.render("admin/forgot-password", {
    title: title("Reset Password"), error: null,
    message: "If an administrator account matches that email, a password reset link has been sent.",
  });
}));

router.get("/reset-password/:token", asyncRoute(async (req, res) => {
  res.set("Cache-Control", "no-store, private");
  res.set("Referrer-Policy", "no-referrer");
  const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } });
  if (!user) return res.status(400).render("admin/reset-password", {
    title: title("Set New Password"), token: "", error: "This reset link is invalid or has expired.",
  });
  return res.render("admin/reset-password", { title: title("Set New Password"), token: req.params.token, error: null });
}));

router.post("/reset-password/:token", asyncRoute(async (req, res) => {
  res.set("Cache-Control", "no-store, private");
  res.set("Referrer-Policy", "no-referrer");
  const password = String(req.body.password || "");
  const confirmation = String(req.body.confirmPassword || "");
  const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } });
  if (!user) return res.status(400).render("admin/reset-password", {
    title: title("Set New Password"), token: "", error: "This reset link is invalid or has expired.",
  });
  if (password.length < 12 || password !== confirmation) return res.status(400).render("admin/reset-password", {
    title: title("Set New Password"), token: req.params.token,
    error: password !== confirmation ? "The passwords do not match." : "Use a password with at least 12 characters.",
  });

  const claimedUser = await User.findOneAndUpdate(
    { _id: user._id, passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } },
    { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } },
    { returnDocument: "before" },
  );
  if (!claimedUser) return res.status(400).render("admin/reset-password", {
    title: title("Set New Password"), token: "", error: "This reset link has already been used or has expired.",
  });
  claimedUser.password = await bcrypt.hash(password, 12);
  await claimedUser.save();
  return res.redirect("/admin/login?reset=success");
}));

router.get("/logout", (req, res, next) => {
  if (!req.session) return res.redirect("/admin/login");
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("nishat.sid", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    return res.redirect("/admin/login");
  });
});

router.use(adminAuth);

router.get("/dashboard", asyncRoute(async (req, res) => {
  const [totalCourses, activeCourses, totalApplications, pendingApplications,
    totalAnnouncements, publishedAnnouncements, recentApplications, recentAnnouncements] = await Promise.all([
    Course.countDocuments(), Course.countDocuments({ status: "active" }), Application.countDocuments(),
    Application.countDocuments({ status: "Pending" }), Announcement.countDocuments(),
    Announcement.countDocuments({ status: "published" }),
    Application.find().populate("course", "title").sort({ createdAt: -1 }).limit(5).lean(),
    Announcement.find().sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  return res.render("admin/dashboard", {
    title: title("Dashboard"), admin: req.session.admin,
    stats: { totalCourses, activeCourses, totalApplications, pendingApplications, totalAnnouncements, publishedAnnouncements },
    recentApplications, recentAnnouncements,
  });
}));

// Course management
router.get("/courses", asyncRoute(async (req, res) => {
  const courses = await Course.find().sort({ createdAt: -1 }).lean();
  const notices = { created: "Course created successfully.", updated: "Course updated successfully.", deleted: "Course deleted successfully." };
  return res.render("admin/courses", { title: title("Courses"), admin: req.session.admin, courses, queryNotice: notices[req.query.created ? "created" : req.query.updated ? "updated" : req.query.deleted ? "deleted" : ""] || null });
}));
router.get("/courses/create", (req, res) => res.render("admin/course-form", {
  title: title("Create Course"), admin: req.session.admin, course: {}, error: null, formAction: "/admin/courses/create",
}));
router.post("/courses/create", asyncRoute(async (req, res) => {
  const values = courseValues(req.body);
  if (!String(req.body.fee ?? "").trim()) {
    return res.status(400).render("admin/course-form", {
      title: title("Create Course"), admin: req.session.admin, course: values,
      error: "Enter the course fee.", formAction: "/admin/courses/create",
    });
  }
  try {
    await Course.create(values);
    return res.redirect("/admin/courses?created=1");
  } catch (error) {
    if (error.name !== "ValidationError") throw error;
    return res.status(400).render("admin/course-form", {
      title: title("Create Course"), admin: req.session.admin, course: values, error: error.message, formAction: "/admin/courses/create",
    });
  }
}));
router.get("/courses/edit/:id", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, "Invalid course ID.");
  const course = await Course.findById(req.params.id).lean();
  if (!course) throw createError(404, "Course not found.");
  return res.render("admin/course-form", {
    title: title("Edit Course"), admin: req.session.admin, course, error: null, formAction: `/admin/courses/edit/${course._id}`,
  });
}));
router.post("/courses/edit/:id", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, "Invalid course ID.");
  const values = courseValues(req.body);
  if (!String(req.body.fee ?? "").trim()) return res.status(400).render("admin/course-form", {
    title: title("Edit Course"), admin: req.session.admin, course: { ...values, _id: req.params.id },
    error: "Enter the course fee.", formAction: `/admin/courses/edit/${req.params.id}`,
  });
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, values, { new: true, runValidators: true });
    if (!course) throw createError(404, "Course not found.");
    return res.redirect("/admin/courses?updated=1");
  } catch (error) {
    if (error.status) throw error;
    return res.status(400).render("admin/course-form", {
      title: title("Edit Course"), admin: req.session.admin, course: { ...values, _id: req.params.id },
      error: error.message, formAction: `/admin/courses/edit/${req.params.id}`,
    });
  }
}));
router.post("/courses/:id/delete", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, "Invalid course ID.");
  if (await Application.exists({ course: req.params.id })) {
    return res.status(409).send("This course has applications. Set it inactive to keep application records intact.");
  }
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) throw createError(404, "Course not found.");
  return res.redirect("/admin/courses?deleted=1");
}));

// Application review
router.get("/applications", asyncRoute(async (req, res) => {
  const filter = ["Pending", "Accepted", "Rejected"].includes(req.query.status) ? { status: req.query.status } : {};
  const applications = await Application.find(filter).populate("course", "title").sort({ createdAt: -1 }).lean();
  return res.render("admin/applications", { title: title("Applications"), admin: req.session.admin, applications, status: req.query.status || "" });
}));
router.get("/applications/:id", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, "Invalid application ID.");
  const application = await Application.findById(req.params.id).populate("course", "title").lean();
  if (!application) throw createError(404, "Application not found.");
  return res.render("admin/application-detail", { title: title("Application"), admin: req.session.admin, application, error: null, updated: req.query.updated === "1" });
}));
router.post("/applications/:id/status", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, "Invalid application ID.");
  const status = String(req.body.status || "");
  if (!["Pending", "Accepted", "Rejected"].includes(status)) throw createError(400, "Invalid application status.");
  const application = await Application.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
  if (!application) throw createError(404, "Application not found.");
  return res.redirect(`/admin/applications/${application._id}?updated=1`);
}));

// Announcement management
router.get("/announcements", asyncRoute(async (req, res) => {
  const announcements = await Announcement.find().sort({ createdAt: -1 }).lean();
  const notices = { created: "Announcement created successfully.", updated: "Announcement updated successfully.", deleted: "Announcement deleted successfully." };
  return res.render("admin/announcements", { title: title("Announcements"), admin: req.session.admin, announcements, queryNotice: notices[req.query.created ? "created" : req.query.updated ? "updated" : req.query.deleted ? "deleted" : ""] || null });
}));
router.get("/announcements/create", (req, res) => res.render("admin/announcement-form", {
  title: title("Create Announcement"), admin: req.session.admin, announcement: {}, error: null, formAction: "/admin/announcements/create",
}));
router.post("/announcements/create", asyncRoute(async (req, res) => {
  const values = announcementValues(req.body);
  try {
    await Announcement.create(values);
    return res.redirect("/admin/announcements?created=1");
  } catch (error) {
    if (error.name !== "ValidationError") throw error;
    return res.status(400).render("admin/announcement-form", {
      title: title("Create Announcement"), admin: req.session.admin, announcement: values, error: error.message, formAction: "/admin/announcements/create",
    });
  }
}));
router.get("/announcements/edit/:id", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, "Invalid announcement ID.");
  const announcement = await Announcement.findById(req.params.id).lean();
  if (!announcement) throw createError(404, "Announcement not found.");
  return res.render("admin/announcement-form", {
    title: title("Edit Announcement"), admin: req.session.admin, announcement, error: null, formAction: `/admin/announcements/edit/${announcement._id}`,
  });
}));
router.post("/announcements/edit/:id", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, "Invalid announcement ID.");
  const values = announcementValues(req.body);
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, values, { new: true, runValidators: true });
    if (!announcement) throw createError(404, "Announcement not found.");
    return res.redirect("/admin/announcements?updated=1");
  } catch (error) {
    if (error.status) throw error;
    return res.status(400).render("admin/announcement-form", {
      title: title("Edit Announcement"), admin: req.session.admin,
      announcement: { ...values, _id: req.params.id }, error: error.message, formAction: `/admin/announcements/edit/${req.params.id}`,
    });
  }
}));
router.post("/announcements/:id/delete", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, "Invalid announcement ID.");
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw createError(404, "Announcement not found.");
  return res.redirect("/admin/announcements?deleted=1");
}));

// Admin account settings
router.get("/settings", (req, res) => res.render("admin/settings", {
  title: title("Settings"), admin: req.session.admin, error: null, message: null,
  queryNotice: req.query.updated ? "Account settings updated." : null,
}));
router.post("/settings", asyncRoute(async (req, res, next) => {
  const user = await User.findById(req.session.admin.id).select("name email password role");
  if (!user || user.role !== "admin") {
    req.session.destroy(() => res.redirect("/admin/login"));
    return;
  }
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  const confirmPassword = String(req.body.confirmPassword || "");
  let error = null;
  if (!name || !emailPattern.test(email)) error = "Enter a name and valid email address.";
  else if (!(await bcrypt.compare(currentPassword, user.password))) error = "Current password is incorrect.";
  else if (newPassword && newPassword.length < 12) error = "A new password must have at least 12 characters.";
  else if (newPassword && newPassword !== confirmPassword) error = "The new passwords do not match.";
  if (error) return res.status(400).render("admin/settings", { title: title("Settings"), admin: req.session.admin, error, message: null, queryNotice: null });

  user.name = name;
  user.email = email;
  if (newPassword) user.password = await bcrypt.hash(newPassword, 12);
  try {
    await user.save();
  } catch (saveError) {
    if (saveError.code === 11000) return res.status(409).render("admin/settings", {
      title: title("Settings"), admin: req.session.admin, error: "That email is already in use.", message: null,
      queryNotice: null,
    });
    throw saveError;
  }
  req.session.admin.name = user.name;
  req.session.admin.email = user.email;
  req.session.save((saveError) => saveError ? next(saveError) : res.redirect("/admin/settings?updated=1"));
}));

router.use((req, res, next) => next(createError(404)));
module.exports = router;

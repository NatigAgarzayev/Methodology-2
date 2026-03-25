const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────────────────────────

mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/password-reset")
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err));

// ─── User Model ───────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    resetToken: {
        type: String,
        default: null,
    },
    resetTokenExpiry: {
        type: Date,
        default: null,
    },
});

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

const User = mongoose.model("User", userSchema);

// ─── Email Transporter ────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendResetEmail(toEmail, resetToken) {
    const resetUrl = `${process.env.APP_BASE_URL || "http://localhost:3000"}/reset-password/validate?token=${resetToken}`;

    const mailOptions = {
        from: process.env.SMTP_FROM || "no-reply@example.com",
        to: toEmail,
        subject: "Password Reset Request",
        text: `You requested a password reset. Use the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
        html: `
      <p>You requested a password reset.</p>
      <p>Use the link below to reset your password. This link expires in <strong>1 hour</strong>.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, please ignore this email.</p>
    `,
    };

    await transporter.sendMail(mailOptions);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /reset-password/request
 * Body: { email }
 * Generates a reset token and emails a reset link to the user.
 */
app.post("/reset-password/request", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required." });
    }

    try {
        const user = await User.findOne({ email });

        // Always respond with success to prevent email enumeration attacks
        if (!user) {
            return res.status(200).json({
                message: "If that email exists, a reset link has been sent.",
            });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        user.resetToken = hashedToken;
        user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save({ validateModifiedOnly: true });

        await sendResetEmail(user.email, rawToken);

        return res.status(200).json({
            message: "If that email exists, a reset link has been sent.",
        });
    } catch (err) {
        console.error("Error in /reset-password/request:", err);
        return res.status(500).json({ message: "Internal server error." });
    }
});

/**
 * GET /reset-password/validate?token=<token>
 * Validates that a reset token exists and has not expired.
 */
app.get("/reset-password/validate", async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ message: "Token is required." });
    }

    try {
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetToken: hashedToken,
            resetTokenExpiry: { $gt: new Date() },
        });

        if (!user) {
            return res
                .status(400)
                .json({ message: "Token is invalid or has expired." });
        }

        return res.status(200).json({ message: "Token is valid." });
    } catch (err) {
        console.error("Error in /reset-password/validate:", err);
        return res.status(500).json({ message: "Internal server error." });
    }
});

/**
 * POST /reset-password/confirm
 * Body: { token, newPassword }
 * Verifies the token and updates the user's password.
 */
app.post("/reset-password/confirm", async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res
            .status(400)
            .json({ message: "Token and newPassword are required." });
    }

    if (newPassword.length < 8) {
        return res
            .status(400)
            .json({ message: "Password must be at least 8 characters." });
    }

    try {
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetToken: hashedToken,
            resetTokenExpiry: { $gt: new Date() },
        });

        if (!user) {
            return res
                .status(400)
                .json({ message: "Token is invalid or has expired." });
        }

        user.password = newPassword; // hashed by the pre-save hook
        user.resetToken = null;
        user.resetTokenExpiry = null;
        await user.save({ validateModifiedOnly: true });

        return res.status(200).json({ message: "Password has been reset successfully." });
    } catch (err) {
        console.error("Error in /reset-password/confirm:", err);
        return res.status(500).json({ message: "Internal server error." });
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());

// =======================
// MongoDB Connection
// =======================
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error(err));

// =======================
// User Model
// =======================
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
});

const User = mongoose.model("User", userSchema);

// =======================
// Email Transporter
// =======================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// =======================
// 1️⃣ Request Password Reset
// =======================
app.post("/request-password-reset", async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const resetLink = `${process.env.BASE_URL}/reset-password/${resetToken}`;

        await transporter.sendMail({
            to: user.email,
            subject: "Password Reset Request",
            html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 1 hour.</p>
      `,
        });

        res.json({ message: "Password reset link sent to email" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// =======================
// 2️⃣ Validate Reset Token
// =======================
app.get("/validate-reset-token/:token", async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        res.json({ message: "Token is valid" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// =======================
// 3️⃣ Set New Password
// =======================
app.post("/reset-password/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ message: "Password has been reset successfully" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// =======================
// Start Server
// =======================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
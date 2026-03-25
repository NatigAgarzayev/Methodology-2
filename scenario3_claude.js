const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────────────────────────
mongoose
    .connect("mongodb://localhost:27017/userdb")
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err));

// ─── User Schema & Model ──────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        phoneNumber: {
            type: String,
            required: true,
            trim: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
        },
        websiteUrl: {
            type: String,
            required: true,
            trim: true,
        },
        bio: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// ─── Validation Rules ─────────────────────────────────────────────────────────
const registrationValidationRules = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Name is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Name must be between 2 and 100 characters"),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Must be a valid email address")
        .normalizeEmail(),

    body("phoneNumber")
        .trim()
        .notEmpty()
        .withMessage("Phone number is required")
        .isMobilePhone()
        .withMessage("Must be a valid phone number"),

    body("dateOfBirth")
        .notEmpty()
        .withMessage("Date of birth is required")
        .isISO8601()
        .withMessage("Date of birth must be a valid date (YYYY-MM-DD)")
        .custom((value) => {
            const dob = new Date(value);
            const today = new Date();
            if (dob >= today) {
                throw new Error("Date of birth must be in the past");
            }
            return true;
        }),

    body("websiteUrl")
        .trim()
        .notEmpty()
        .withMessage("Website URL is required")
        .isURL({ protocols: ["http", "https"], require_protocol: true })
        .withMessage("Must be a valid URL (http or https)"),

    body("bio")
        .trim()
        .notEmpty()
        .withMessage("Bio is required")
        .isLength({ min: 10, max: 1000 })
        .withMessage("Bio must be between 10 and 1000 characters"),
];

// ─── Registration Endpoint ────────────────────────────────────────────────────
app.post("/api/register", registrationValidationRules, async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map((err) => ({
                field: err.path,
                message: err.msg,
            })),
        });
    }

    const { name, email, phoneNumber, dateOfBirth, websiteUrl, bio } = req.body;

    try {
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                errors: [{ field: "email", message: "Email is already registered" }],
            });
        }

        const user = new User({
            name,
            email,
            phoneNumber,
            dateOfBirth: new Date(dateOfBirth),
            websiteUrl,
            bio,
        });

        await user.save();

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                dateOfBirth: user.dateOfBirth,
                websiteUrl: user.websiteUrl,
                bio: user.bio,
                createdAt: user.createdAt,
            },
        });
    } catch (err) {
        console.error("Registration error:", err);
        return res.status(500).json({
            success: false,
            errors: [{ message: "Internal server error" }],
        });
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
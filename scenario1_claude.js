const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());

app.use(
    session({
        secret: "session_secret_key",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,      // set to true if using HTTPS
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24, // 24 hours
        },
    })
);

// ─── Database Connection ──────────────────────────────────────────────────────

mongoose
    .connect("mongodb://localhost:27017/myapp")
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err));

// ─── User Model ───────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
    {
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
    },
    { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

const User = mongoose.model("User", userSchema);

// ─── Login Endpoint ───────────────────────────────────────────────────────────

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        // Look up the user by email
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Start session
        req.session.userId = user._id;
        req.session.email = user.email;

        return res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                email: user.email,
            },
        });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// server.js
// Run: npm install express mongoose bcryptjs jsonwebtoken dotenv
// Start: node server.js

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

// ─── Config ───────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey_change_in_prod";
const MONGO_URI =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rbac_demo";
const PORT = process.env.PORT || 3000;

// ─── Mongoose Connection ───────────────────────────────────────────────────────

mongoose
    .connect(MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => {
        console.error("MongoDB connection error:", err.message);
        process.exit(1);
    });

// ─── User Schema & Model ───────────────────────────────────────────────────────

const ROLES = ["admin", "editor", "viewer"];

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        role: {
            type: String,
            enum: ROLES,
            required: true,
            default: "viewer",
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

// Compare plaintext password to stored hash
userSchema.methods.comparePassword = function (plain) {
    return bcrypt.compare(plain, this.password);
};

const User = mongoose.model("User", userSchema);

// ─── Content Schema & Model ───────────────────────────────────────────────────

const contentSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        body: { type: String, required: true },
        updatedBy: { type: String },
    },
    { timestamps: true }
);

const Content = mongoose.model("Content", contentSchema);

// ─── Authentication Middleware ─────────────────────────────────────────────────

/**
 * Verifies the Bearer JWT in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
            .status(401)
            .json({ error: "Missing or malformed Authorization header" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, username, role }
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

// ─── Role-Checking Middleware Factory ─────────────────────────────────────────

/**
 * Returns middleware that allows only the specified roles.
 * Must be used AFTER authenticate middleware.
 *
 * @param {...string} allowedRoles - Roles permitted to access the route.
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Forbidden: requires one of [${allowedRoles.join(", ")}]`,
            });
        }

        next();
    };
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Body: { username, password, role }
 * Creates a new user account.
 */
app.post("/auth/register", async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "username and password are required" });
    }

    if (role && !ROLES.includes(role)) {
        return res
            .status(400)
            .json({ error: `role must be one of: ${ROLES.join(", ")}` });
    }

    try {
        const user = new User({ username, password, role: role || "viewer" });
        await user.save();

        return res.status(201).json({
            message: "User registered",
            user: { id: user._id, username: user.username, role: user.role },
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "Username already taken" });
        }
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /auth/login
 * Body: { username, password }
 * Returns a signed JWT on success.
 */
app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "username and password are required" });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const match = await user.comparePassword(password);
        if (!match) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: "8h" }
        );

        return res.json({ token, role: user.role });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── User Routes ──────────────────────────────────────────────────────────────

/**
 * GET /users
 * Access: admin only
 * Returns a list of all registered users (passwords excluded).
 */
app.get(
    "/users",
    authenticate,
    authorize("admin"),
    async (_req, res) => {
        try {
            const users = await User.find({}, "-password -__v");
            return res.json({ users });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

// ─── Content Routes ───────────────────────────────────────────────────────────

/**
 * GET /content
 * Access: admin, editor, viewer (all authenticated roles)
 * Returns all content documents.
 */
app.get(
    "/content",
    authenticate,
    authorize("admin", "editor", "viewer"),
    async (_req, res) => {
        try {
            const items = await Content.find({}, "-__v");
            return res.json({ content: items });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

/**
 * PUT /content/:id
 * Access: admin, editor
 * Body: { title?, body? }
 * Updates an existing content document by ID.
 */
app.put(
    "/content/:id",
    authenticate,
    authorize("admin", "editor"),
    async (req, res) => {
        const { title, body } = req.body;

        if (!title && !body) {
            return res
                .status(400)
                .json({ error: "Provide at least one field to update: title, body" });
        }

        try {
            const updates = {};
            if (title) updates.title = title;
            if (body) updates.body = body;
            updates.updatedBy = req.user.username;

            const item = await Content.findByIdAndUpdate(
                req.params.id,
                { $set: updates },
                { new: true, runValidators: true, projection: { __v: 0 } }
            );

            if (!item) {
                return res.status(404).json({ error: "Content not found" });
            }

            return res.json({ message: "Content updated", content: item });
        } catch (err) {
            if (err.name === "CastError") {
                return res.status(400).json({ error: "Invalid content ID" });
            }
            return res.status(500).json({ error: err.message });
        }
    }
);

/**
 * POST /content  (helper — lets you seed content without a separate script)
 * Access: admin, editor
 * Body: { title, body }
 * Creates a new content document.
 */
app.post(
    "/content",
    authenticate,
    authorize("admin", "editor"),
    async (req, res) => {
        const { title, body } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: "title and body are required" });
        }

        try {
            const item = new Content({ title, body, updatedBy: req.user.username });
            await item.save();
            return res.status(201).json({ message: "Content created", content: item });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

// ─── 404 Fallback ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Available routes:");
    console.log("  POST /auth/register  — register a new user");
    console.log("  POST /auth/login     — get a JWT token");
    console.log("  GET  /users          — admin only");
    console.log("  GET  /content        — all roles");
    console.log("  POST /content        — admin, editor");
    console.log("  PUT  /content/:id    — admin, editor");
});
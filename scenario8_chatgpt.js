const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

/* ============================
   MongoDB Connection
============================ */
mongoose.connect("mongodb://127.0.0.1:27017/rbac_app", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

/* ============================
   User Schema
============================ */
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ["admin", "editor", "viewer"],
        required: true,
    },
});

const User = mongoose.model("User", userSchema);

/* ============================
   JWT Secret
============================ */
const JWT_SECRET = "your_jwt_secret_key";

/* ============================
   Authentication Middleware
============================ */
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(400).json({ message: "Invalid token." });
    }
};

/* ============================
   Role Middleware
============================ */
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: Insufficient role." });
        }
        next();
    };
};

/* ============================
   Routes
============================ */

/* Register User */
app.post("/register", async (req, res) => {
    try {
        const { username, password, role } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            password: hashedPassword,
            role,
        });

        await user.save();
        res.status(201).json({ message: "User registered successfully." });
    } catch (err) {
        res.status(400).json({ message: "Registration failed.", error: err.message });
    }
});

/* Login User */
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: "Invalid credentials." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: "Login failed." });
    }
});

/* Get All Users - Admin Only */
app.get("/users", authenticate, authorizeRoles("admin"), async (req, res) => {
    const users = await User.find().select("-password");
    res.json(users);
});

/* Update Content - Admin and Editor */
let content = "Initial Content";

app.put("/content", authenticate, authorizeRoles("admin", "editor"), (req, res) => {
    const { newContent } = req.body;
    content = newContent;
    res.json({ message: "Content updated successfully." });
});

/* View Content - All Roles */
app.get("/content", authenticate, authorizeRoles("admin", "editor", "viewer"), (req, res) => {
    res.json({ content });
});

/* ============================
   Server Start
============================ */
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
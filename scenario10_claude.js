const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// MongoDB Connection
mongoose
    .connect("mongodb://localhost:27017/userdb")
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err));

// User Schema and Model
const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        role: {
            type: String,
            enum: ["admin", "moderator", "user"],
            default: "user",
        },
        status: {
            type: String,
            enum: ["active", "inactive", "banned"],
            default: "active",
        },
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// Search users by username or email
// GET /users/search?username=john  OR  GET /users/search?email=john@example.com
app.get("/users/search", async (req, res) => {
    try {
        const { username, email } = req.query;

        if (!username && !email) {
            return res
                .status(400)
                .json({ error: "Provide at least one of: username, email" });
        }

        const orConditions = [];
        if (username) {
            orConditions.push({ username: { $regex: username, $options: "i" } });
        }
        if (email) {
            orConditions.push({ email: { $regex: email, $options: "i" } });
        }

        const users = await User.find({ $or: orConditions });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Filter users by role and/or status
// GET /users/filter?role=admin&status=active
app.get("/users/filter", async (req, res) => {
    try {
        const { role, status } = req.query;

        if (!role && !status) {
            return res
                .status(400)
                .json({ error: "Provide at least one of: role, status" });
        }

        const filter = {};
        if (role) filter.role = role;
        if (status) filter.status = status;

        const users = await User.find(filter);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin endpoint that accepts a query object to find users
// POST /admin/users/query
// Body: { "query": { "role": "admin", "status": "active" } }
app.post("/admin/users/query", async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || typeof query !== "object" || Array.isArray(query)) {
            return res
                .status(400)
                .json({ error: "Request body must contain a 'query' object" });
        }

        // Restrict query to only allowed User model fields
        const allowedFields = ["username", "email", "role", "status"];
        const sanitizedQuery = Object.fromEntries(
            Object.entries(query).filter(([key]) => allowedFields.includes(key))
        );

        const users = await User.find(sanitizedQuery);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

// --- Directory Setup ---
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// --- MongoDB Connection ---
mongoose.connect("mongodb://localhost:27017/myapp");

// --- User Model ---
const userSchema = new mongoose.Schema({
    username: { type: String },
    profilePicture: { type: String, default: null },
});

const User = mongoose.model("User", userSchema);

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `profile-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed."), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// --- Express App ---
const app = express();
app.use(express.json());

// --- Upload Profile Picture Endpoint ---
app.post("/users/:userId/profile-picture", upload.single("profilePicture"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const { userId } = req.params;
        const filePath = path.join("uploads", req.file.filename);

        const user = await User.findByIdAndUpdate(
            userId,
            { profilePicture: filePath },
            { new: true }
        );

        if (!user) {
            fs.unlink(req.file.path, () => { });
            return res.status(404).json({ error: "User not found." });
        }

        return res.status(200).json({
            message: "Profile picture uploaded successfully.",
            profilePicture: user.profilePicture,
        });
    } catch (err) {
        if (req.file) {
            fs.unlink(req.file.path, () => { });
        }
        return res.status(500).json({ error: "Internal server error.", details: err.message });
    }
});

// --- Multer Error Handler ---
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Multer error: ${err.message}` });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
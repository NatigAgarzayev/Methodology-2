const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/profile_pictures', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User Schema
const userSchema = new mongoose.Schema({
    username: String,
    profilePicturePath: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

const app = express();

// Upload endpoint
app.post('/upload-profile-picture/:userId', upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.params.userId;
        const filePath = path.join(uploadsDir, req.file.filename);

        // Update user record with file path
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { profilePicturePath: filePath },
            { new: true, upsert: false }
        );

        if (!updatedUser) {
            // If user doesn't exist, delete the uploaded file
            fs.unlinkSync(filePath);
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Profile picture uploaded successfully',
            filePath: filePath,
            user: updatedUser
        });
    } catch (error) {
        // Clean up file if there was an error
        if (req.file) {
            const filePath = path.join(uploadsDir, req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware for multer errors
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB' });
        }
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
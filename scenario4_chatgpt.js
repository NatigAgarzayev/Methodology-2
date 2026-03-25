// app.js

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ======================
// MongoDB Connection
// ======================
mongoose.connect('mongodb://127.0.0.1:27017/profile_upload_db', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// ======================
// User Model
// ======================
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    profilePicture: { type: String },
});

const User = mongoose.model('User', userSchema);

// ======================
// Express App Setup
// ======================
const app = express();
app.use(express.json());

// ======================
// Ensure Uploads Directory Exists
// ======================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// ======================
// Multer Configuration
// ======================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    },
});

const upload = multer({ storage: storage });

// ======================
// Upload Profile Picture Endpoint
// ======================
app.post('/upload-profile-picture', upload.single('profilePicture'), async (req, res) => {
    try {
        const { userId } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const filePath = path.join('uploads', req.file.filename);

        const user = await User.findByIdAndUpdate(
            userId,
            { profilePicture: filePath },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            message: 'Profile picture uploaded successfully',
            profilePicture: filePath,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ======================
// Start Server
// ======================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
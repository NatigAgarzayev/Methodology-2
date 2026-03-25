// app.js

const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const app = express();

// Middleware
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/user_registration', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// User Schema and Model
const userSchema = new mongoose.Schema({
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
    },
    dateOfBirth: {
        type: Date,
        required: true,
    },
    websiteUrl: {
        type: String,
        required: true,
    },
    bio: {
        type: String,
        required: true,
    },
});

const User = mongoose.model('User', userSchema);

// Registration Endpoint
app.post(
    '/register',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('phoneNumber')
            .matches(/^\+?[1-9]\d{1,14}$/)
            .withMessage('Valid phone number is required'),
        body('dateOfBirth')
            .isISO8601()
            .withMessage('Valid date of birth is required'),
        body('websiteUrl')
            .isURL()
            .withMessage('Valid website URL is required'),
        body('bio').notEmpty().withMessage('Bio is required'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { name, email, phoneNumber, dateOfBirth, websiteUrl, bio } = req.body;

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already registered' });
            }

            const user = new User({
                name,
                email,
                phoneNumber,
                dateOfBirth,
                websiteUrl,
                bio,
            });

            await user.save();

            res.status(201).json({ message: 'User registered successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/userdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },
    dateOfBirth: {
        type: Date,
        required: true
    },
    websiteURL: {
        type: String,
        trim: true
    },
    bio: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);

const registrationValidations = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),

    body('phoneNumber')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Phone number can only contain digits, spaces, hyphens, plus signs, and parentheses'),

    body('dateOfBirth')
        .notEmpty().withMessage('Date of birth is required')
        .isISO8601().withMessage('Date of birth must be in ISO 8601 format (YYYY-MM-DD)')
        .custom((value) => {
            const dob = new Date(value);
            const today = new Date();
            if (dob >= today) {
                throw new Error('Date of birth must be in the past');
            }
            return true;
        }),

    body('websiteURL')
        .optional({ checkFalsy: true })
        .trim()
        .isURL().withMessage('Must be a valid URL'),

    body('bio')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters')
];

app.post('/register', registrationValidations, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const userData = {
            name: req.body.name,
            email: req.body.email,
            phoneNumber: req.body.phoneNumber,
            dateOfBirth: new Date(req.body.dateOfBirth),
            websiteURL: req.body.websiteURL || '',
            bio: req.body.bio || ''
        };

        const user = new User(userData);
        await user.save();

        res.status(201).json({
            message: 'User registered successfully',
            userId: user._id
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                errors: [{
                    msg: 'Email already exists',
                    param: 'email'
                }]
            });
        }
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, User };
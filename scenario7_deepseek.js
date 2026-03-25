const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validator = require('validator');

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/auth_demo', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User Schema
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Email transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// 1. Request password reset endpoint
app.post('/api/password-reset/request', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User with this email does not exist'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Set token and expiration (1 hour)
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // Create reset URL
        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: user.email,
            subject: 'Password Reset Request',
            html: `
                <h2>Password Reset Request</h2>
                <p>You requested to reset your password. Click the link below to proceed:</p>
                <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                    Reset Password
                </a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.status(200).json({
            success: true,
            message: 'Password reset email sent successfully'
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// 2. Validate reset token endpoint
app.get('/api/password-reset/validate/:token', async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Reset token is required'
            });
        }

        // Hash the token to compare with stored hash
        const resetTokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find user with valid token and not expired
        const user = await User.findOne({
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Reset token is valid',
            email: user.email
        });

    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// 3. Set new password endpoint
app.post('/api/password-reset/set-new', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Reset token is required'
            });
        }

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Hash the token to compare with stored hash
        const resetTokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find user with valid token and not expired
        const user = await User.findOne({
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Update password and clear reset token
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        // Send confirmation email
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: user.email,
            subject: 'Password Changed Successfully',
            html: `
                <h2>Password Updated</h2>
                <p>Your password has been successfully changed.</p>
                <p>If you didn't make this change, please contact support immediately.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({
            success: true,
            message: 'Password has been reset successfully'
        });

    } catch (error) {
        console.error('Set new password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────────────────────────

mongoose.connect('mongodb://localhost:27017/jwt_auth_db', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => console.log('MongoDB connected'));
mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));

// ─── User Model ───────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    refreshTokens: {
        type: [String],
        default: [],
    },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare plaintext password against stored hash
userSchema.methods.comparePassword = function (plaintext) {
    return bcrypt.compare(plaintext, this.password);
};

const User = mongoose.model('User', userSchema);

// ─── JWT Helpers ──────────────────────────────────────────────────────────────

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret_change_me';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_change_me';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function generateAccessToken(payload) {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload) {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // Expect header: "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token missing' });
    }

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Access token invalid or expired' });
        }
        req.user = decoded;
        next();
    });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /register — create a new user (convenience endpoint for testing)
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already taken' });
        }

        const user = await User.create({ username, password });
        res.status(201).json({ message: 'User created', userId: user._id });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST /login — validate credentials, return access + refresh tokens
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const passwordMatch = await user.comparePassword(password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = { userId: user._id, username: user.username };
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // Persist the refresh token so it can be validated and revoked later
        user.refreshTokens.push(refreshToken);
        await user.save();

        res.status(200).json({ accessToken, refreshToken });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST /refresh — exchange a valid refresh token for a new access token
app.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh token required' });
        }

        // Verify the token signature and expiry
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        } catch (err) {
            return res.status(403).json({ message: 'Refresh token invalid or expired' });
        }

        // Confirm the token is still in the user's stored list (not revoked)
        const user = await User.findById(decoded.userId);
        if (!user || !user.refreshTokens.includes(refreshToken)) {
            return res.status(403).json({ message: 'Refresh token not recognised' });
        }

        // Rotate: remove the old refresh token and issue a new pair
        user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);

        const payload = { userId: user._id, username: user.username };
        const newAccessToken = generateAccessToken(payload);
        const newRefreshToken = generateRefreshToken(payload);

        user.refreshTokens.push(newRefreshToken);
        await user.save();

        res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /protected — example route that requires a valid access token
app.get('/protected', authenticateToken, (req, res) => {
    res.status(200).json({
        message: 'You have access to this protected resource',
        user: { userId: req.user.userId, username: req.user.username },
    });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const JWT_SECRET = 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = 'your-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

mongoose.connect('mongodb://localhost:27017/auth-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    refreshToken: { type: String }
});

const User = mongoose.model('User', UserSchema);

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            JWT_REFRESH_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        user.refreshToken = refreshToken;
        await user.save();

        res.json({
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: 900
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid refresh token' });
            }

            const user = await User.findById(decoded.userId);
            if (!user || user.refreshToken !== refreshToken) {
                return res.status(403).json({ error: 'Invalid refresh token' });
            }

            const newAccessToken = jwt.sign(
                { userId: user._id, username: user.username },
                JWT_SECRET,
                { expiresIn: ACCESS_TOKEN_EXPIRY }
            );

            res.json({
                accessToken: newAccessToken,
                tokenType: 'Bearer',
                expiresIn: 900
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({
        message: 'Protected data',
        user: req.user
    });
});

app.post('/api/logout', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (user) {
            user.refreshToken = null;
            await user.save();
        }
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
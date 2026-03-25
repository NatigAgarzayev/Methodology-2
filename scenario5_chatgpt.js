// app.js

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

// ====== CONFIG ======
const MONGO_URI = 'mongodb://127.0.0.1:27017/jwt_auth_db';
const JWT_SECRET = 'your_access_secret';
const JWT_REFRESH_SECRET = 'your_refresh_secret';
const PORT = 3000;

// ====== MONGODB CONNECTION ======
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// ====== USER MODEL ======
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// ====== AUTH MIDDLEWARE ======
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ====== LOGIN ENDPOINT ======
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
        { id: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { id: user._id, username: user.username },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );

    res.json({ accessToken, refreshToken });
});

// ====== PROTECTED ROUTE ======
app.get('/protected', authenticateToken, (req, res) => {
    res.json({
        message: 'Protected data accessed successfully',
        user: req.user
    });
});

// ====== TOKEN REFRESH ENDPOINT ======
app.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token required' });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired refresh token' });
        }

        const newAccessToken = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ accessToken: newAccessToken });
    });
});

// ====== SERVER START ======
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
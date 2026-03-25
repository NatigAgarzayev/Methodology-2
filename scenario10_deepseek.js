const express = require('express');
const mongoose = require('mongoose');
const app = express();

// Middleware setup
app.use(express.json());

// User Schema and Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Endpoint 1: Search users by username or email
app.get('/users/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query parameter "q" is required' });
        }

        const users = await User.find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } }
            ]
        }).select('-__v');

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint 2: Filter users by role and/or status
app.get('/users/filter', async (req, res) => {
    try {
        const { role, status } = req.query;
        const filter = {};

        if (role) {
            if (!['user', 'admin', 'moderator'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role value' });
            }
            filter.role = role;
        }

        if (status) {
            if (!['active', 'inactive', 'suspended'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status value' });
            }
            filter.status = status;
        }

        const users = await User.find(filter).select('-__v');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint 3: Admin endpoint with query object
app.post('/admin/users', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || typeof query !== 'object') {
            return res.status(400).json({ error: 'Query object is required in request body' });
        }

        // Validate query fields against schema
        const allowedFields = ['username', 'email', 'role', 'status', 'createdAt'];
        const queryKeys = Object.keys(query);

        for (const key of queryKeys) {
            if (!allowedFields.includes(key)) {
                return res.status(400).json({
                    error: `Field "${key}" is not allowed in query. Allowed fields: ${allowedFields.join(', ')}`
                });
            }
        }

        // Validate role and status values if present
        if (query.role && !['user', 'admin', 'moderator'].includes(query.role)) {
            return res.status(400).json({ error: 'Invalid role value in query' });
        }

        if (query.status && !['active', 'inactive', 'suspended'].includes(query.status)) {
            return res.status(400).json({ error: 'Invalid status value in query' });
        }

        const users = await User.find(query).select('-__v');
        res.json(users);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid query value type' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Database connection and server startup
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/userdb';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
    });

module.exports = { app, User };
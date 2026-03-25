const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/userdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// User Schema and Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    status: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Endpoint: Search user by username or email
app.get('/users/search', async (req, res) => {
    try {
        const { username, email } = req.query;

        if (!username && !email) {
            return res.status(400).json({ error: 'Provide username or email' });
        }

        const query = {};
        if (username) query.username = username;
        if (email) query.email = email;

        const users = await User.find(query);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Endpoint: Filter users by role and status
app.get('/users/filter', async (req, res) => {
    try {
        const { role, status } = req.query;

        const query = {};
        if (role) query.role = role;
        if (status) query.status = status;

        const users = await User.find(query);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin Endpoint: Accept query object to find users
app.post('/admin/users/query', async (req, res) => {
    try {
        const query = req.body;

        if (!query || typeof query !== 'object') {
            return res.status(400).json({ error: 'Invalid query object' });
        }

        const users = await User.find(query);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
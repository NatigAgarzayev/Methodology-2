const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/rbac-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['admin', 'editor', 'viewer'],
        default: 'viewer',
        required: true
    }
});

const User = mongoose.model('User', userSchema);

// Content Schema (for demonstration)
const contentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    updatedBy: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const Content = mongoose.model('Content', contentSchema);

// Authentication Middleware
const authenticate = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, 'your-secret-key');
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Role Checking Middleware
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// Authentication Endpoint (for obtaining tokens)
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password, role = 'viewer' } = req.body;

        if (!['admin', 'editor', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword, role });
        await user.save();

        const token = jwt.sign({ userId: user._id }, 'your-secret-key');
        res.status(201).json({ token, user: { id: user._id, username, role } });
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(400).json({ error: error.message });
        }
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, 'your-secret-key');
        res.json({ token, user: { id: user._id, username, role: user.role } });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Admin only: Get all users
app.get('/users', authenticate, requireRole(['admin']), async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin and editor: Update content
app.put('/content/:id', authenticate, requireRole(['admin', 'editor']), async (req, res) => {
    try {
        const { title, body } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'Title and body are required' });
        }

        const content = await Content.findByIdAndUpdate(
            req.params.id,
            {
                title,
                body,
                updatedBy: req.user.username,
                updatedAt: Date.now()
            },
            { new: true, upsert: true }
        );

        res.json(content);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// All roles: View content
app.get('/content/:id', authenticate, async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);

        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        res.json(content);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// All roles: Get all content
app.get('/content', authenticate, async (req, res) => {
    try {
        const content = await Content.find();
        res.json(content);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create initial content if none exists
async function initializeContent() {
    const count = await Content.countDocuments();
    if (count === 0) {
        await Content.create({
            title: 'Welcome',
            body: 'This is initial content',
            updatedBy: 'system'
        });
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeContent();
});
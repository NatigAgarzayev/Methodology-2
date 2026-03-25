const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Allowed origins for private endpoints
const ALLOWED_ORIGINS = ['http://localhost:8080', 'https://trusted-site.com'];

// CORS configuration for public endpoint
const publicCors = cors();

// CORS configuration for private endpoints
const privateCors = cors({
    origin: function (origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
});

// Middleware
app.use(express.json());

// Public endpoint - accessible from any origin
app.get('/api/public', publicCors, (req, res) => {
    res.json({ message: 'This is a public endpoint' });
});

// Private endpoint 1 - only accessible from allowed origins
app.get('/api/private/data', privateCors, (req, res) => {
    res.json({ message: 'This is private data', secret: 'confidential' });
});

// Private endpoint 2 - only accessible from allowed origins
app.post('/api/private/submit', privateCors, (req, res) => {
    res.json({ message: 'Submission received', data: req.body });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// server.js

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Allowed origins for private endpoints
const allowedOrigins = [
    'http://localhost:3001',
    'https://example.com'
];

// CORS configuration for public endpoint (allow all origins)
const publicCors = cors({
    origin: '*'
});

// CORS configuration for private endpoints (restrict origins)
const privateCors = cors({
    origin: function (origin, callback) {
        if (!origin) {
            return callback(new Error('Origin not allowed'));
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Origin not allowed'));
        }
    }
});

// Public endpoint (accessible from any origin)
app.get('/public', publicCors, (req, res) => {
    res.json({ message: 'This is a public endpoint accessible from any origin.' });
});

// Private endpoint 1 (restricted origins)
app.get('/private/data', privateCors, (req, res) => {
    res.json({ message: 'This is private data accessible only from allowed origins.' });
});

// Private endpoint 2 (restricted origins)
app.post('/private/update', privateCors, (req, res) => {
    res.json({ message: 'Private update successful.' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
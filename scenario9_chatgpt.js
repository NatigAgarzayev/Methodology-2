// app.js

const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();

// Built-in middleware
app.use(express.json());

// Rate limiting middleware (100 requests per 15 minutes per IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

app.use(limiter);

// Sample routes

// Success route
app.get('/api/success', (req, res) => {
    res.status(200).json({ message: 'Request successful.' });
});

// 400 Bad Request example
app.get('/api/bad-request', (req, res, next) => {
    const error = new Error('Bad Request example.');
    error.status = 400;
    next(error);
});

// 404 Not Found example
app.get('/api/not-found', (req, res, next) => {
    const error = new Error('Resource not found.');
    error.status = 404;
    next(error);
});

// 500 Internal Server Error example
app.get('/api/server-error', (req, res, next) => {
    const error = new Error('Internal Server Error example.');
    error.status = 500;
    next(error);
});

// Catch-all for undefined routes
app.use((req, res, next) => {
    const error = new Error('Route not found.');
    error.status = 404;
    next(error);
});

// Custom error handling middleware
app.use((err, req, res, next) => {
    const statusCode = err.status || 500;

    res.status(statusCode).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: statusCode
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3000;

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to all requests
app.use(limiter);

// Custom error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: {
            message: message,
            status: statusCode
        }
    });
};

// Custom error classes
class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 404;
        this.name = 'NotFoundError';
    }
}

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 400;
        this.name = 'ValidationError';
    }
}

class ForbiddenError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 403;
        this.name = 'ForbiddenError';
    }
}

// API endpoints demonstrating error handling

// GET /api/data/:id - Returns data if id exists
app.get('/api/data/:id', (req, res, next) => {
    const { id } = req.params;
    const dataStore = {
        '1': { name: 'Item 1', value: 100 },
        '2': { name: 'Item 2', value: 200 }
    };

    if (!dataStore[id]) {
        next(new NotFoundError(`Data with id ${id} not found`));
        return;
    }

    res.json(dataStore[id]);
});

// POST /api/data - Creates new data with validation
app.post('/api/data', (req, res, next) => {
    // Simulating request body validation
    const { name, value } = req.body;

    if (!name || !value) {
        next(new ValidationError('Both "name" and "value" fields are required'));
        return;
    }

    if (typeof value !== 'number') {
        next(new ValidationError('Field "value" must be a number'));
        return;
    }

    res.json({
        message: 'Data created successfully',
        data: { name, value }
    });
});

// PUT /api/data/:id - Updates data with permission check
app.put('/api/data/:id', (req, res, next) => {
    const { id } = req.params;

    // Simulating permission check
    const userHasPermission = false; // Hardcoded to demonstrate error

    if (!userHasPermission) {
        next(new ForbiddenError('You do not have permission to update this data'));
        return;
    }

    res.json({
        message: `Data with id ${id} updated successfully`
    });
});

// GET /api/error - Demonstrates generic error
app.get('/api/error', (req, res, next) => {
    // Simulating an unexpected error
    next(new Error('This is a simulated unexpected error'));
});

// GET /api/health - Health check endpoint (no errors)
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Apply error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
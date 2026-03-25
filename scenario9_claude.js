const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                  // limit each IP to 100 requests per windowMs
    standardHeaders: true,     // return rate limit info in RateLimit-* headers
    legacyHeaders: false,      // disable X-RateLimit-* headers
    handler: (req, res, next, options) => {
        const err = new Error("Too many requests, please try again later.");
        err.status = 429;
        next(err);
    },
});

app.use(limiter);

// ─── Custom Error Class ───────────────────────────────────────────────────────

class AppError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = this.constructor.name;
    }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /         — healthy endpoint
app.get("/", (req, res) => {
    res.json({ message: "API is running." });
});

// GET /users/:id — demonstrates a 404 Not Found error
app.get("/users/:id", (req, res, next) => {
    const validIds = [1, 2, 3];
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
        return next(new AppError("User ID must be a number.", 400));
    }

    if (!validIds.includes(id)) {
        return next(new AppError(`User with ID ${id} not found.`, 404));
    }

    res.json({ id, name: `User ${id}`, email: `user${id}@example.com` });
});

// POST /data — demonstrates a 400 Bad Request error
app.post("/data", (req, res, next) => {
    const { name, value } = req.body;

    if (!name || !value) {
        return next(
            new AppError("Request body must include both 'name' and 'value'.", 400)
        );
    }

    if (typeof value !== "number") {
        return next(new AppError("'value' must be a number.", 422));
    }

    res.status(201).json({ received: { name, value } });
});

// GET /secret — demonstrates a 403 Forbidden error
app.get("/secret", (req, res, next) => {
    const token = req.headers["x-auth-token"];

    if (!token) {
        return next(new AppError("Access denied. No token provided.", 403));
    }

    if (token !== "mysecrettoken") {
        return next(new AppError("Access denied. Invalid token.", 403));
    }

    res.json({ secret: "You have access to the secret data." });
});

// GET /crash — demonstrates an unhandled 500 Internal Server Error
app.get("/crash", (req, res, next) => {
    try {
        throw new Error("Something went wrong internally.");
    } catch (err) {
        next(err); // forwarded to the error handler below
    }
});

// ─── 404 Handler (unknown routes) ────────────────────────────────────────────

app.use((req, res, next) => {
    next(new AppError(`Route ${req.method} ${req.path} not found.`, 404));
});

// ─── Global Error Handling Middleware ─────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";

    // Log server-side errors
    if (status >= 500) {
        console.error(`[${new Date().toISOString()}] ${status} — ${message}`);
    }

    res.status(status).json({
        error: {
            status,
            message,
        },
    });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
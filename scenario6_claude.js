const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// CORS configurations
// ---------------------------------------------------------------------------

// Public CORS – allow any origin
const publicCors = cors();

// Private CORS – restrict to specific allowed origins only
const ALLOWED_ORIGINS = ["https://example.com", "https://app.example.com"];

const privateCors = cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server / curl)
        if (!origin) {
            return callback(null, true);
        }
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`CORS policy: origin '${origin}' is not allowed`));
    },
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * PUBLIC endpoint
 * Accessible from ANY origin.
 * GET /public
 */
app.get("/public", publicCors, (req, res) => {
    res.json({
        endpoint: "public",
        message: "This endpoint is accessible from any origin.",
        origin: req.headers.origin ?? "no origin header present",
    });
});

/**
 * PRIVATE endpoint
 * Accessible only from origins listed in ALLOWED_ORIGINS.
 * GET /private
 */
app.get("/private", privateCors, (req, res) => {
    res.json({
        endpoint: "private",
        message: "This endpoint is restricted to allowed origins only.",
        origin: req.headers.origin ?? "no origin header present",
    });
});

/**
 * PRIVATE endpoint (second example)
 * Accessible only from origins listed in ALLOWED_ORIGINS.
 * GET /private/data
 */
app.get("/private/data", privateCors, (req, res) => {
    res.json({
        endpoint: "private/data",
        message: "Sensitive data accessible only from allowed origins.",
        data: { id: 1, value: "secret-value" },
        origin: req.headers.origin ?? "no origin header present",
    });
});

// Handle pre-flight requests for private routes
app.options("/private", privateCors);
app.options("/private/data", privateCors);

// ---------------------------------------------------------------------------
// Error handler – catches CORS rejections and other errors
// ---------------------------------------------------------------------------

app.use((err, req, res, _next) => {
    if (err.message && err.message.startsWith("CORS policy")) {
        return res.status(403).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`  Public  endpoint : http://localhost:${PORT}/public`);
    console.log(`  Private endpoint : http://localhost:${PORT}/private`);
    console.log(`  Private endpoint : http://localhost:${PORT}/private/data`);
    console.log(`  Allowed origins  : ${ALLOWED_ORIGINS.join(", ")}`);
});
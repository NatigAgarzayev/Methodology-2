// server.js

const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

// PostgreSQL connection setup
const pool = new Pool({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database',
    port: 5432,
});

// GET /products?search=term&category=categoryName&minPrice=10&maxPrice=100
app.get('/products', async (req, res) => {
    const { search, category, minPrice, maxPrice } = req.query;

    let query = 'SELECT * FROM products WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (search) {
        query += ` AND name ILIKE $${paramIndex}`;
        values.push(`%${search}%`);
        paramIndex++;
    }

    if (category) {
        query += ` AND category = $${paramIndex}`;
        values.push(category);
        paramIndex++;
    }

    if (minPrice) {
        query += ` AND price >= $${paramIndex}`;
        values.push(minPrice);
        paramIndex++;
    }

    if (maxPrice) {
        query += ` AND price <= $${paramIndex}`;
        values.push(maxPrice);
        paramIndex++;
    }

    try {
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error executing query', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
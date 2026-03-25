const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'products_db',
    password: process.env.PGPASSWORD || 'password',
    port: process.env.PGPORT || 5432,
});

app.get('/api/products/search', async (req, res) => {
    try {
        const { search, category, minPrice, maxPrice } = req.query;

        let query = 'SELECT * FROM products WHERE 1=1';
        const values = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            values.push(`%${search}%`);
        }

        if (category) {
            paramCount++;
            query += ` AND category = $${paramCount}`;
            values.push(category);
        }

        if (minPrice) {
            paramCount++;
            query += ` AND price >= $${paramCount}`;
            values.push(parseFloat(minPrice));
        }

        if (maxPrice) {
            paramCount++;
            query += ` AND price <= $${paramCount}`;
            values.push(parseFloat(maxPrice));
        }

        const result = await pool.query(query, values);

        res.json({
            products: result.rows,
            count: result.rowCount
        });

    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
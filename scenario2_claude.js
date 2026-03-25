const express = require('express');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'mydb',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

app.get('/products', async (req, res) => {
    const { search, category, min_price, max_price } = req.query;

    const conditions = [];
    const values = [];

    if (search) {
        values.push(`%${search}%`);
        conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }

    if (category) {
        values.push(category);
        conditions.push(`category = $${values.length}`);
    }

    if (min_price !== undefined) {
        const min = parseFloat(min_price);
        if (isNaN(min)) {
            return res.status(400).json({ error: 'min_price must be a valid number' });
        }
        values.push(min);
        conditions.push(`price >= $${values.length}`);
    }

    if (max_price !== undefined) {
        const max = parseFloat(max_price);
        if (isNaN(max)) {
            return res.status(400).json({ error: 'max_price must be a valid number' });
        }
        values.push(max);
        conditions.push(`price <= $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM products ${whereClause} ORDER BY id ASC`;

    try {
        const result = await pool.query(sql, values);
        res.json({ products: result.rows, count: result.rowCount });
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
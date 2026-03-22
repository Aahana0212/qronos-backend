const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all categories
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categories');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all menu items with optional limit
router.get('/items', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        const [rows] = await db.query(
            'SELECT * FROM menu_items WHERE is_available = true LIMIT ?',
            [limit]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE menu item
router.delete('/items/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

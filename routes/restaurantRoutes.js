const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET all restaurants
router.get('/', async (req, res) => {
    try {
        const [restaurants] = await pool.query(
            'SELECT id, name, slug, rating, rating_count, cuisine_type, timings, address, image_url FROM restaurants WHERE status = "active"'
        );
        res.json({ success: true, restaurants });
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET categories (must be defined BEFORE /:restaurantId to avoid route collision)
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await pool.query(
            'SELECT id, name, display_order FROM categories WHERE status = "active" ORDER BY display_order'
        );
        res.json({ success: true, categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET menu items for a restaurant
// `all=1` returns every item (including unavailable) — used by the restaurant-side menu manager.
router.get('/:restaurantId/menu', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { orderType = 'delivery', all } = req.query;

        const showAll = all === '1' || all === 'true';
        const sql = showAll
            ? 'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY id DESC'
            : 'SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1';

        const [menuItems] = await pool.query(sql, [restaurantId]);

        res.json({ success: true, menuItems, restaurantId, orderType });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET single restaurant by ID
router.get('/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const [restaurants] = await pool.query(
            'SELECT * FROM restaurants WHERE id = ? AND status = "active"',
            [restaurantId]
        );

        if (restaurants.length === 0) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }

        res.json({ success: true, restaurant: restaurants[0] });
    } catch (error) {
        console.error('Error fetching restaurant:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
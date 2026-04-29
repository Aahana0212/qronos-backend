const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET /api/menu - Get all menu items
router.get('/', async (req, res) => {
    try {
        const [items] = await pool.query(
            'SELECT * FROM menu_items ORDER BY id DESC'
        );
        res.json({ success: true, menuItems: items });
    } catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/menu/restaurant/:restaurantId - Get menu items for a restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const [items] = await pool.query(
            'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY id DESC',
            [restaurantId]
        );
        res.json(items);
    } catch (error) {
        console.error('Error fetching restaurant menu:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/menu/restaurant/:restaurantId/count - Get menu item count
router.get('/restaurant/:restaurantId/count', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const [result] = await pool.query(
            'SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?',
            [restaurantId]
        );
        res.json({ count: result[0]?.count || 0 });
    } catch (error) {
        console.error('Error fetching menu count:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/menu - Add a menu item
router.post('/', async (req, res) => {
    const { restaurant_id, name, description, price, takeaway_price, category_id, category, is_veg, is_available } = req.body;

    if (!name || !price || !restaurant_id) {
        return res.status(400).json({ error: 'Name, price, and restaurant_id are required' });
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO menu_items (restaurant_id, name, description, price, takeaway_price, category_id, is_veg, is_available)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                restaurant_id,
                name,
                description || null,
                price,
                takeaway_price || price,
                category_id || category || null,
                is_veg || 0,
                is_available !== undefined ? is_available : 1
            ]
        );

        res.json({
            success: true,
            id: result.insertId,
            message: 'Menu item added successfully'
        });
    } catch (error) {
        console.error('Error adding menu item:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/menu/:id - Update a menu item
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, takeaway_price, category_id, category, is_veg, is_available } = req.body;

    try {
        await pool.query(
            `UPDATE menu_items SET name = ?, description = ?, price = ?, takeaway_price = ?, category_id = ?, is_veg = ?, is_available = ?
             WHERE id = ?`,
            [
                name,
                description || null,
                price,
                takeaway_price || price,
                category_id || category || null,
                is_veg || 0,
                is_available !== undefined ? is_available : 1,
                id
            ]
        );

        res.json({ success: true, message: 'Menu item updated successfully' });
    } catch (error) {
        console.error('Error updating menu item:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/menu/:id - Delete a menu item
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Menu item deleted successfully' });
    } catch (error) {
        console.error('Error deleting menu item:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET cart items for user
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { restaurantId, orderType } = req.query;

    try {
        let query = `
            SELECT ci.*, m.name, m.description, m.price, m.takeaway_price, m.image_url, m.is_veg, m.preparation_time
            FROM cart_items ci
            JOIN menu_items m ON ci.menu_item_id = m.id
            WHERE ci.user_id = ?
        `;
        const params = [userId];

        if (restaurantId) {
            query += ' AND ci.restaurant_id = ?';
            params.push(restaurantId);
        }

        const [items] = await pool.query(query, params);

        res.json({
            success: true,
            cart: { items, total_items: items.length }
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ error: error.message });
    }
});

// ADD to cart
router.post('/add', async (req, res) => {
    const { user_id, restaurant_id, menu_item_id, quantity, price } = req.body;

    if (!user_id || !restaurant_id || !menu_item_id || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Check if item already in cart
        const [existing] = await pool.query(
            'SELECT * FROM cart_items WHERE user_id = ? AND menu_item_id = ?',
            [user_id, menu_item_id]
        );

        if (existing.length > 0) {
            // Update quantity
            await pool.query(
                'UPDATE cart_items SET quantity = quantity + ? WHERE user_id = ? AND menu_item_id = ?',
                [quantity, user_id, menu_item_id]
            );
        } else {
            // Insert new item
            await pool.query(
                'INSERT INTO cart_items (user_id, restaurant_id, menu_item_id, quantity, price_at_time) VALUES (?, ?, ?, ?, ?)',
                [user_id, restaurant_id, menu_item_id, quantity, price]
            );
        }

        res.json({ success: true, message: 'Item added to cart' });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE cart item quantity
router.put('/update', async (req, res) => {
    const { user_id, menu_item_id, quantity } = req.body;

    if (!user_id || !menu_item_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        if (quantity <= 0) {
            // Remove item
            await pool.query(
                'DELETE FROM cart_items WHERE user_id = ? AND menu_item_id = ?',
                [user_id, menu_item_id]
            );
        } else {
            // Update quantity
            await pool.query(
                'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND menu_item_id = ?',
                [quantity, user_id, menu_item_id]
            );
        }

        res.json({ success: true, message: 'Cart updated' });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ error: error.message });
    }
});

// REMOVE from cart
router.delete('/remove/:userId/:itemId', async (req, res) => {
    const { userId, itemId } = req.params;

    try {
        await pool.query(
            'DELETE FROM cart_items WHERE user_id = ? AND menu_item_id = ?',
            [userId, itemId]
        );
        res.json({ success: true, message: 'Item removed from cart' });
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ error: error.message });
    }
});

// CLEAR cart
router.delete('/clear/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        await pool.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
        res.json({ success: true, message: 'Cart cleared' });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ error: error.message });
    }
});

// SYNC cart (replace entire cart)
router.post('/sync', async (req, res) => {
    const { userId, restaurantId, items, orderType } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    try {
        await pool.query('START TRANSACTION');

        // Delete existing cart items for this user
        await pool.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

        // Insert new items
        if (items && items.length > 0) {
            for (const item of items) {
                await pool.query(
                    'INSERT INTO cart_items (user_id, restaurant_id, menu_item_id, quantity, price_at_time) VALUES (?, ?, ?, ?, ?)',
                    [userId, restaurantId, item.menu_item_id, item.quantity, item.price]
                );
            }
        }

        await pool.query('COMMIT');
        res.json({ success: true, message: 'Cart synced successfully' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error syncing cart:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
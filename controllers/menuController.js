const { pool } = require('../config/db');

// Get all menu items (with filters)
const getAllMenuItems = async (req, res) => {
    const { restaurant_id, category_id, is_available = '1', is_popular, search } = req.query;

    try {
        let query = `
            SELECT m.*, c.name as category_name, r.name as restaurant_name 
            FROM menu_items m
            LEFT JOIN categories c ON m.category_id = c.id
            LEFT JOIN restaurants r ON m.restaurant_id = r.id
            WHERE m.is_available = ?
        `;
        let params = [is_available === 'true' || is_available === '1'];

        if (restaurant_id) {
            query += ' AND m.restaurant_id = ?';
            params.push(restaurant_id);
        }

        if (category_id) {
            query += ' AND m.category_id = ?';
            params.push(category_id);
        }

        if (is_popular === 'true') {
            query += ' AND m.is_popular = 1';
        }

        if (search) {
            query += ' AND (m.name LIKE ? OR m.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY m.is_popular DESC, m.rating DESC';

        const [items] = await pool.query(query, params);
        res.json({ success: true, menuItems: items });
    } catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get single menu item
const getMenuItemById = async (req, res) => {
    const { id } = req.params;

    try {
        const [items] = await pool.query(
            `SELECT m.*, c.name as category_name, r.name as restaurant_name, r.slug as restaurant_slug
             FROM menu_items m
             LEFT JOIN categories c ON m.category_id = c.id
             LEFT JOIN restaurants r ON m.restaurant_id = r.id
             WHERE m.id = ?`,
            [id]
        );

        if (items.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        res.json({ success: true, item: items[0] });
    } catch (error) {
        console.error('Error fetching menu item:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get menu items by restaurant
const getMenuByRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    const { orderType = 'delivery', category_id } = req.query;

    try {
        let query = `
            SELECT m.*, c.name as category_name
            FROM menu_items m
            LEFT JOIN categories c ON m.category_id = c.id
            WHERE m.restaurant_id = ? AND m.is_available = 1
        `;
        const params = [restaurantId];

        if (category_id) {
            query += ' AND m.category_id = ?';
            params.push(category_id);
        }

        query += ' ORDER BY m.is_popular DESC, m.rating DESC';

        const [items] = await pool.query(query, params);
        res.json({ success: true, menuItems: items, restaurantId, orderType });
    } catch (error) {
        console.error('Error fetching restaurant menu:', error);
        res.status(500).json({ error: error.message });
    }
};

// Create new menu item
const createMenuItem = async (req, res) => {
    const {
        restaurant_id,
        name,
        description,
        price,
        takeaway_price,
        category_id,
        is_veg,
        is_popular,
        preparation_time,
        image_url
    } = req.body;

    if (!restaurant_id || !name || !price) {
        return res.status(400).json({ error: 'Restaurant ID, name and price are required' });
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO menu_items (restaurant_id, name, description, price, takeaway_price, category_id, 
             is_veg, is_popular, preparation_time, image_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [restaurant_id, name, description, price, takeaway_price, category_id, 
             is_veg || false, is_popular || false, preparation_time || 15, image_url]
        );

        const [newItem] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [result.insertId]);

        res.json({ success: true, item: newItem[0], message: 'Menu item created' });
    } catch (error) {
        console.error('Error creating menu item:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update menu item
const updateMenuItem = async (req, res) => {
    const { id } = req.params;
    const {
        name,
        description,
        price,
        takeaway_price,
        category_id,
        is_veg,
        is_popular,
        is_available,
        preparation_time,
        image_url
    } = req.body;

    try {
        await pool.query(
            `UPDATE menu_items SET 
             name = ?, description = ?, price = ?, takeaway_price = ?, category_id = ?, 
             is_veg = ?, is_popular = ?, is_available = ?, preparation_time = ?, image_url = ?
             WHERE id = ?`,
            [name, description, price, takeaway_price, category_id, 
             is_veg, is_popular, is_available, preparation_time, image_url, id]
        );

        const [updatedItem] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [id]);

        res.json({ success: true, item: updatedItem[0], message: 'Menu item updated' });
    } catch (error) {
        console.error('Error updating menu item:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete menu item
const deleteMenuItem = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM menu_items WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        res.json({ success: true, message: 'Menu item deleted' });
    } catch (error) {
        console.error('Error deleting menu item:', error);
        res.status(500).json({ error: error.message });
    }
};

// Toggle menu item availability
const toggleAvailability = async (req, res) => {
    const { id } = req.params;
    const { is_available } = req.body;

    try {
        await pool.query(
            'UPDATE menu_items SET is_available = ? WHERE id = ?',
            [is_available, id]
        );
        res.json({ success: true, message: `Item ${is_available ? 'available' : 'unavailable'}` });
    } catch (error) {
        console.error('Error toggling availability:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get popular items
const getPopularItems = async (req, res) => {
    const { restaurantId } = req.params;
    const { limit = 10 } = req.query;

    try {
        const [items] = await pool.query(
            'SELECT * FROM menu_items WHERE restaurant_id = ? AND is_popular = 1 AND is_available = 1 ORDER BY rating DESC LIMIT ?',
            [restaurantId, parseInt(limit)]
        );
        res.json({ success: true, popularItems: items });
    } catch (error) {
        console.error('Error fetching popular items:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get menu by category
const getMenuByCategory = async (req, res) => {
    const { restaurantId, categoryId } = req.params;

    try {
        const [items] = await pool.query(
            `SELECT m.*, c.name as category_name 
             FROM menu_items m
             JOIN categories c ON m.category_id = c.id
             WHERE m.restaurant_id = ? AND m.category_id = ? AND m.is_available = 1`,
            [restaurantId, categoryId]
        );
        res.json({ success: true, menuItems: items });
    } catch (error) {
        console.error('Error fetching menu by category:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllMenuItems,
    getMenuItemById,
    getMenuByRestaurant,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
    getPopularItems,
    getMenuByCategory
};
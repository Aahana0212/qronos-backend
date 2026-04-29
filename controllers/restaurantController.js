const { pool } = require('../config/db');

// Get all restaurants
const getAllRestaurants = async (req, res) => {
    try {
        const [restaurants] = await pool.query(
            'SELECT id, name, slug, rating, rating_count, cuisine_type, timings, address, image_url FROM restaurants WHERE status = "active"'
        );
        res.json({ success: true, restaurants });
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single restaurant by ID
const getRestaurantById = async (req, res) => {
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
};

// Get restaurant by slug
const getRestaurantBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const [restaurants] = await pool.query(
            'SELECT * FROM restaurants WHERE slug = ? AND status = "active"',
            [slug]
        );
        
        if (restaurants.length === 0) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        
        res.json({ success: true, restaurant: restaurants[0] });
    } catch (error) {
        console.error('Error fetching restaurant by slug:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all categories
const getAllCategories = async (req, res) => {
    try {
        const [categories] = await pool.query(
            'SELECT id, name, display_order FROM categories WHERE status = "active" ORDER BY display_order'
        );
        res.json({ success: true, categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get menu items for a restaurant
const getRestaurantMenu = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { orderType = 'delivery' } = req.query;
        
        const [menuItems] = await pool.query(
            'SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1',
            [restaurantId]
        );
        
        res.json({ success: true, menuItems, restaurantId, orderType });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create new restaurant (for registration)
const createRestaurant = async (req, res) => {
    const { name, slug, phone, address, cuisine_type, timings, delivery_settings, takeaway_settings } = req.body;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO restaurants (name, slug, phone, address, cuisine_type, timings, delivery_settings, takeaway_settings, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "active")',
            [name, slug, phone, address, cuisine_type, timings, JSON.stringify(delivery_settings), JSON.stringify(takeaway_settings)]
        );
        
        res.json({ success: true, restaurantId: result.insertId });
    } catch (error) {
        console.error('Error creating restaurant:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update restaurant settings
const updateRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    const { name, phone, address, cuisine_type, timings, delivery_settings, takeaway_settings } = req.body;
    
    try {
        await pool.query(
            'UPDATE restaurants SET name = ?, phone = ?, address = ?, cuisine_type = ?, timings = ?, delivery_settings = ?, takeaway_settings = ? WHERE id = ?',
            [name, phone, address, cuisine_type, timings, JSON.stringify(delivery_settings), JSON.stringify(takeaway_settings), restaurantId]
        );
        
        res.json({ success: true, message: 'Restaurant updated successfully' });
    } catch (error) {
        console.error('Error updating restaurant:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllRestaurants,
    getRestaurantById,
    getRestaurantBySlug,
    getAllCategories,
    getRestaurantMenu,
    createRestaurant,
    updateRestaurant
};
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// Customer login
const customerLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND role = "customer"',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Customer login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

// Restaurant staff login (owner, admin, kitchen)
const restaurantLogin = async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Email, password and role are required' });
    }

    try {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND role = ?',
            [email, role]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            restaurantId: user.restaurant_id,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Restaurant login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

// Customer registration
const customerRegister = async (req, res) => {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, "customer")',
            [name, email, phone, hashedPassword]
        );

        const token = jwt.sign(
            { id: result.insertId, email, role: 'customer' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: result.insertId,
                name,
                email,
                phone,
                role: 'customer'
            }
        });
    } catch (error) {
        console.error('Customer registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

// Restaurant registration (with owner account)
const registerRestaurant = async (req, res) => {
    const { restaurant, owner } = req.body;

    if (!restaurant.name || !owner.name || !owner.email || !owner.password) {
        return res.status(400).json({ error: 'Restaurant name and owner details required' });
    }

    try {
        const [existingUser] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [owner.email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create restaurant
        const slug = restaurant.slug || restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const [restoResult] = await pool.query(
            'INSERT INTO restaurants (name, slug, phone, address, cuisine_type, timings, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [restaurant.name, slug, restaurant.phone || null, restaurant.address || null, restaurant.cuisine_type || null, restaurant.timings || null]
        );

        const restaurantId = restoResult.insertId;

        // Create owner user
        const hashedPassword = await bcrypt.hash(owner.password, 10);
        const [userResult] = await pool.query(
            'INSERT INTO users (name, email, phone, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, "owner", ?)',
            [owner.name, owner.email, owner.phone || null, hashedPassword, restaurantId]
        );

        const token = jwt.sign(
            { id: userResult.insertId, email: owner.email, role: 'owner', restaurantId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Restaurant registered successfully',
            token,
            restaurantId,
            user: {
                id: userResult.insertId,
                name: owner.name,
                email: owner.email,
                phone: owner.phone,
                role: 'owner'
            }
        });
    } catch (error) {
        console.error('Restaurant registration error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Add staff member (owner only)
const addStaff = async (req, res) => {
    const { restaurantId, name, email, phone, password, role } = req.body;

    if (!restaurantId || !name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['admin', 'kitchen'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be admin or kitchen' });
    }

    try {
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (name, email, phone, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, phone, hashedPassword, role, restaurantId]
        );

        res.json({
            success: true,
            message: `${role} added successfully`,
            user: {
                id: result.insertId,
                name,
                email,
                phone,
                role
            }
        });
    } catch (error) {
        console.error('Add staff error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all staff for a restaurant
const getStaffByRestaurant = async (req, res) => {
    const { restaurantId } = req.params;

    try {
        const [staff] = await pool.query(
            'SELECT id, name, email, phone, role, created_at FROM users WHERE restaurant_id = ? AND role IN ("admin", "kitchen")',
            [restaurantId]
        );
        res.json({ success: true, staff });
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({ error: error.message });
    }
};

// Remove staff member
const removeStaff = async (req, res) => {
    const { userId } = req.params;

    try {
        await pool.query('DELETE FROM users WHERE id = ? AND role IN ("admin", "kitchen")', [userId]);
        res.json({ success: true, message: 'Staff member removed' });
    } catch (error) {
        console.error('Error removing staff:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    customerLogin,
    restaurantLogin,
    customerRegister,
    registerRestaurant,
    addStaff,
    getStaffByRestaurant,
    removeStaff
};
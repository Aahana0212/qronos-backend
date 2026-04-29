const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// ============ CUSTOMER LOGIN - SAME, NO CHANGE ============
router.post('/customer-login', async (req, res) => {
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
});

// ============ RESTAURANT LOGIN ============
router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    console.log('🔐 Restaurant Login Attempt:', { email, role });

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Email, password and role are required' });
    }

    try {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND role = ?',
            [email, role]
        );

        if (users.length === 0) {
            console.log('❌ User not found for', email, role);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const passwordOk = user.password_hash
            ? await bcrypt.compare(password, user.password_hash)
            : false;

        if (!passwordOk) {
            console.log('❌ Wrong password for', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.restaurant_id) {
            console.log('❌ User has no restaurant_id:', user.id);
            return res.status(403).json({ error: 'No restaurant linked to this user' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ Login OK — user ${user.id}, restaurant ${user.restaurant_id}`);

        res.json({
            success: true,
            token,
            restaurantId: user.restaurant_id,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                restaurant_id: user.restaurant_id
            }
        });
    } catch (error) {
        console.error('Restaurant login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============ REGISTER - SAME ============
router.post('/register', async (req, res) => {
    const { name, email, phone, password, role } = req.body;

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
        const userRole = role || 'customer';

        const [result] = await pool.query(
            'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [name, email, phone, hashedPassword, userRole]
        );

        const token = jwt.sign(
            { id: result.insertId, email, role: userRole },
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
                role: userRole
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// ============ REGISTER RESTAURANT (with owner) - SAME ============
router.post('/register-restaurant', async (req, res) => {
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

        const slug = restaurant.slug || restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const [restoResult] = await pool.query(
            'INSERT INTO restaurants (name, slug, phone, address, cuisine_type, status) VALUES (?, ?, ?, ?, ?, "active")',
            [restaurant.name, slug, restaurant.phone || null, restaurant.address || null, restaurant.type || null]
        );

        const restaurantId = restoResult.insertId;

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
});

// ============ STAFF MANAGEMENT ENDPOINTS ============

router.get('/staff/restaurant/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        
        const [staff] = await pool.query(
            `SELECT id, name, email, phone, role, created_at 
             FROM users 
             WHERE restaurant_id = ? AND role IN ('admin', 'kitchen')
             ORDER BY created_at DESC`,
            [restaurantId]
        );
        
        res.json(staff);
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/staff/restaurant/:restaurantId/count', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        
        const [result] = await pool.query(
            'SELECT COUNT(*) as count FROM users WHERE restaurant_id = ? AND role IN ("admin", "kitchen")',
            [restaurantId]
        );
        
        res.json({ count: result[0]?.count || 0 });
    } catch (error) {
        console.error('Error fetching staff count:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/staff', async (req, res) => {
    const { name, email, phone, password, role, restaurant_id } = req.body;
    
    if (!name || !email || !password || !restaurant_id) {
        return res.status(400).json({ error: 'Name, email, password and restaurant_id are required' });
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
            [name, email, phone || null, hashedPassword, role || 'kitchen', restaurant_id]
        );
        
        res.json({
            success: true,
            id: result.insertId,
            message: 'Staff added successfully'
        });
    } catch (error) {
        console.error('Error adding staff:', error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        const [user] = await pool.query('SELECT id FROM users WHERE id = ?', [req.params.id]);
        
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
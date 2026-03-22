const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// GET /api/auth/users - Get all users (admin only)
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, name, email, phone, role, created_at FROM users ORDER BY id DESC'
        );
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ============ REGISTER (with role) ============
router.post('/register', async (req, res) => {
    // ✅ PEHLE ROLE LE RAHE HAIN
    const { name, email, phone, password, role } = req.body;

    console.log('Register request:', { name, email, phone, role }); // DEBUG

    if (!name || !email || !phone || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // ✅ Role validation
    const allowedRoles = ['customer', 'kitchen', 'admin'];
    const userRole = allowedRoles.includes(role) ? role : 'customer';

    console.log('Saving with role:', userRole); // DEBUG

    try {
        // Check if user already exists
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? OR phone = ?',
            [email, phone]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ Insert user with SELECTED role (NOT hardcoded)
        const [result] = await db.query(
            `INSERT INTO users (name, email, phone, password_hash, role, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [name, email, phone, hashedPassword, userRole]  // ✅ YAHAN userRole USE KARO
        );

        // Generate token
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

// ============ LOGIN ============
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?',
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
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// DELETE user
router.delete('/users/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
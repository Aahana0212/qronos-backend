// routes/staff.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// GET /api/auth/staff/restaurant/:restaurantId - Get all staff members
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

// GET /api/auth/staff/restaurant/:restaurantId/count - Get staff count
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

// POST /api/auth/staff - Add staff member
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

// DELETE /api/auth/users/:id - Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
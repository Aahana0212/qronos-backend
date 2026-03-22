const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET contact info
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM contact_info LIMIT 1');
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            // Default values if no data
            res.json({
                address: '123 Food Street, Mumbai - 400001',
                phone1: '+91 98765 43210',
                phone2: '+91 98765 43211',
                email1: 'info@qronos.com',
                email2: 'support@qronos.com',
                hoursWeekday: 'Mon - Fri: 11:00 AM - 11:00 PM',
                hoursWeekend: 'Sat - Sun: 11:00 AM - 12:00 AM'
            });
        }
    } catch (error) {
        console.error('Error fetching contact info:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST contact message
router.post('/send', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email and message are required' });
    }

    try {
        // Save message to database
        await db.query(
            `INSERT INTO contact_messages (name, email, subject, message, created_at) 
             VALUES (?, ?, ?, ?, NOW())`,
            [name, email, subject || null, message]
        );
        
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error saving contact message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
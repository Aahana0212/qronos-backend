const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get today's specials (random 3 items)
router.get('/specials', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT m.*, c.name as category_name 
            FROM menu_items m
            LEFT JOIN categories c ON m.category_id = c.id
            WHERE m.is_available = true
            ORDER BY RAND()
            LIMIT 3
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching specials:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get featured/testimonials (you can create a testimonials table later)
router.get('/testimonials', async (req, res) => {
    // Static testimonials for now
    const testimonials = [
        {
            id: 1,
            name: "Rahul Sharma",
            rating: 5,
            text: "Amazing experience! Ordered from my phone and food arrived in 15 minutes. The QR system is so convenient.",
            image: "/api/placeholder/60/60"
        },
        {
            id: 2,
            name: "Priya Patel",
            rating: 5,
            text: "Best restaurant experience! No waiting for waiters, just scan and order. Food quality is exceptional.",
            image: "/api/placeholder/60/60"
        }
    ];
    res.json(testimonials);
});

module.exports = router;
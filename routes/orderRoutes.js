const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/orders/user/:phone - Get orders by user phone
router.get('/user/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        
        const [orders] = await db.query(`
            SELECT o.*, 
                   GROUP_CONCAT(
                       CONCAT(oi.quantity, 'x ', mi.name) 
                       SEPARATOR ', '
                   ) as items_summary,
                   COUNT(oi.id) as item_count
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE o.customer_phone = ?
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `, [phone]);
        
        res.json(orders);
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/orders/user/:phone - Get orders by user phone
router.get('/user/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        
        const [orders] = await db.query(`
            SELECT o.*, 
                   GROUP_CONCAT(
                       CONCAT(oi.quantity, 'x ', mi.name) 
                       SEPARATOR ', '
                   ) as items_summary
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE o.customer_phone = ?
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `, [phone]);
        
        res.json(orders);
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ============ GET ALL ORDERS (For Admin) ============
router.get('/', async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT o.*, 
                   GROUP_CONCAT(
                       CONCAT(oi.quantity, 'x ', mi.name) 
                       SEPARATOR ', '
                   ) as items_summary
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `);
        res.json(orders);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ============ POST - Place new order ============
router.post('/', async (req, res) => {
    const {
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        table_number,
        delivery_address,
        special_instructions,
        items,
        total_amount,
        payment_method
    } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items in order' });
    }

    const orderNumber = 'ORD' + Date.now().toString().slice(-8);

    try {
        await db.query('START TRANSACTION');

        const [orderResult] = await db.query(
            `INSERT INTO orders (
                order_number, customer_name, customer_phone, customer_email,
                order_type, table_number, delivery_address, special_instructions,
                total_amount, payment_method, order_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                orderNumber, customer_name, customer_phone, customer_email || null,
                order_type, table_number || null, delivery_address || null,
                special_instructions || null, total_amount, payment_method, 'placed'
            ]
        );

        const orderId = orderResult.insertId;

        for (const item of items) {
            await db.query(
                `INSERT INTO order_items (
                    order_id, menu_item_id, quantity, price_at_time, subtotal
                ) VALUES (?, ?, ?, ?, ?)`,
                [orderId, item.id, item.quantity, item.price, item.price * item.quantity]
            );
        }

        await db.query('COMMIT');

        res.json({
            success: true,
            orderId: orderId,
            orderNumber: orderNumber,
            message: 'Order placed successfully'
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error placing order:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// ============ GET - Order by ID ============
router.get('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const [orders] = await db.query(
            `SELECT o.*, 
                    oi.quantity, oi.price_at_time,
                    mi.name as item_name, mi.id as item_id
             FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.order_number = ? OR o.id = ?`,
            [orderId, orderId]
        );
        
        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const orderData = {
            id: orders[0].id,
            orderNumber: orders[0].order_number,
            orderType: orders[0].order_type,
            orderStatus: orders[0].order_status,
            total: parseFloat(orders[0].total_amount),
            customerName: orders[0].customer_name,
            customerPhone: orders[0].customer_phone,
            deliveryAddress: orders[0].delivery_address,
            orderDate: orders[0].created_at,
            items: orders.filter(o => o.item_id).map(o => ({
                id: o.item_id,
                name: o.item_name,
                quantity: o.quantity,
                price: parseFloat(o.price_at_time),
                subtotal: o.quantity * o.price_at_time
            }))
        };
        
        res.json(orderData);
        
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ============ PUT - Update order status ============
router.put('/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        await db.query(
            'UPDATE orders SET order_status = ? WHERE order_number = ? OR id = ?',
            [status, orderId, orderId]
        );
        
        res.json({ success: true, status });
        
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
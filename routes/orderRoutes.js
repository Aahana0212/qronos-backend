const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Generate order ID
const generateOrderId = () => {
    return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
};

// CREATE ORDER
router.post('/', async (req, res) => {
    const {
        user_id,
        restaurant_id,
        order_type,
        items,
        subtotal,
        delivery_fee,
        tax,
        total_amount,
        payment_method,
        delivery_address,
        table_number,
        pickup_time,
        customer_name,
        customer_phone,
        special_instructions
    } = req.body;

    console.log('📦 New order payload:', {
        user_id, restaurant_id, order_type, customer_name, customer_phone, total_amount
    });

    if (!restaurant_id || !items || items.length === 0) {
        return res.status(400).json({ error: 'Restaurant and items are required' });
    }

    // Normalise customer details. If the frontend sent blank/whitespace and
    // the order is tied to a logged-in user, look the name up from the users
    // table so the restaurant side never sees a nameless ticket.
    let finalCustomerName = (customer_name || '').toString().trim();
    let finalCustomerPhone = (customer_phone || '').toString().trim();

    if ((!finalCustomerName || !finalCustomerPhone) && user_id) {
        try {
            const [rows] = await pool.query(
                'SELECT name, phone FROM users WHERE id = ? LIMIT 1',
                [user_id]
            );
            if (rows.length > 0) {
                if (!finalCustomerName) finalCustomerName = (rows[0].name || '').trim();
                if (!finalCustomerPhone) finalCustomerPhone = (rows[0].phone || '').trim();
            }
        } catch (e) {
            console.warn('User lookup for order customer fallback failed:', e.message);
        }
    }

    if (!finalCustomerName) finalCustomerName = 'Guest';

    const orderId = generateOrderId();

    try {
        await pool.query('START TRANSACTION');

        const [orderResult] = await pool.query(
            `INSERT INTO orders (order_id, user_id, restaurant_id, order_type, subtotal, delivery_fee, tax, total_amount,
             payment_method, delivery_address, table_number, pickup_time, customer_name, customer_phone, special_instructions, order_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [orderId, user_id || null, restaurant_id, order_type, subtotal, delivery_fee, tax, total_amount,
             payment_method, delivery_address || null, table_number || null, pickup_time || null,
             finalCustomerName, finalCustomerPhone || null, special_instructions || null]
        );

        for (const item of items) {
            await pool.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES (?, ?, ?, ?)',
                [orderResult.insertId, item.menu_item_id, item.quantity, item.price_at_time]
            );
        }

        if (user_id) {
            await pool.query('DELETE FROM cart_items WHERE user_id = ?', [user_id]);
        }

        await pool.query('COMMIT');

        console.log(`✅ Order ${orderId} stored — customer="${finalCustomerName}", phone="${finalCustomerPhone}"`);

        res.json({
            success: true,
            orderId: orderId,
            message: 'Order placed successfully'
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Order creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET orders by user ID
router.get('/user/:userId', async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT o.*, r.name as restaurant_name 
             FROM orders o 
             JOIN restaurants r ON o.restaurant_id = r.id 
             WHERE o.user_id = ? 
             ORDER BY o.created_at DESC`,
            [req.params.userId]
        );
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single order by order_id
router.get('/:orderId', async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address 
             FROM orders o 
             JOIN restaurants r ON o.restaurant_id = r.id 
             WHERE o.order_id = ?`,
            [req.params.orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const [items] = await pool.query(
            `SELECT oi.*, m.name, m.image_url 
             FROM order_items oi 
             JOIN menu_items m ON oi.menu_item_id = m.id 
             WHERE oi.order_id = ?`,
            [orders[0].id]
        );

        res.json({ success: true, order: orders[0], items });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE order status
router.put('/:orderId/status', async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        await pool.query(
            'UPDATE orders SET order_status = ? WHERE order_id = ?',
            [status, req.params.orderId]
        );
        res.json({ success: true, message: `Order status updated to ${status}` });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ RESTAURANT DASHBOARD ENDPOINTS (NEW) ============

// GET /api/orders/restaurant/:restaurantId/today - Today's orders stats
router.get('/restaurant/:restaurantId/today', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const today = new Date().toISOString().split('T')[0];
        
        // Today's orders count
        const [todayCountResult] = await pool.query(
            'SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ?',
            [restaurantId, today]
        );
        
        // Pending orders count
        const [pendingResult] = await pool.query(
            'SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND order_status = "pending"',
            [restaurantId]
        );
        
        // Preparing orders count
        const [preparingResult] = await pool.query(
            'SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND order_status = "preparing"',
            [restaurantId]
        );
        
        // Ready orders count
        const [readyResult] = await pool.query(
            'SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND order_status = "ready"',
            [restaurantId]
        );
        
        // Today's revenue
        const [revenueResult] = await pool.query(
            'SELECT SUM(total_amount) as revenue FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ? AND order_status != "cancelled"',
            [restaurantId, today]
        );
        
        // Recent orders (last 5) — prefer the form-entered customer name over
        // the logged-in user's account name.
        const [recentOrders] = await pool.query(
            `SELECT o.*,
                    COALESCE(NULLIF(TRIM(o.customer_name), ''), NULLIF(TRIM(u.name), ''), 'Guest') AS customer_name
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.restaurant_id = ?
             ORDER BY o.created_at DESC
             LIMIT 5`,
            [restaurantId]
        );
        
        res.json({
            todayCount: todayCountResult[0]?.count || 0,
            pendingCount: pendingResult[0]?.count || 0,
            preparingCount: preparingResult[0]?.count || 0,
            readyCount: readyResult[0]?.count || 0,
            todayRevenue: revenueResult[0]?.revenue || 0,
            recentOrders: recentOrders
        });
    } catch (error) {
        console.error('Error fetching today orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/orders/restaurant/:restaurantId/live - Active (non-completed) orders for admin live view
router.get('/restaurant/:restaurantId/live', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        // Prefer the customer name entered at checkout (o.customer_name) over the
        // logged-in user's account name. The user's account name is only a
        // fallback when the form was left blank.
        const [orders] = await pool.query(
            `SELECT o.*, o.order_id AS order_number,
                    COALESCE(NULLIF(TRIM(o.customer_name), ''), NULLIF(TRIM(u.name), ''), 'Guest') AS customer_name
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.restaurant_id = ?
               AND o.order_status NOT IN ('delivered', 'completed', 'cancelled')
             ORDER BY o.created_at DESC`,
            [restaurantId]
        );
        res.json(orders);
    } catch (error) {
        console.error('Error fetching live orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/orders/kitchen/:restaurantId - Kitchen display queue grouped by status
router.get('/kitchen/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const today = new Date().toISOString().split('T')[0];

        const [orders] = await pool.query(
            `SELECT o.*, o.order_id AS order_number
             FROM orders o
             WHERE o.restaurant_id = ?
               AND o.order_status NOT IN ('delivered', 'completed', 'cancelled')
             ORDER BY o.created_at ASC`,
            [restaurantId]
        );

        // Attach items to each order in one batched query.
        if (orders.length > 0) {
            const orderIds = orders.map(o => o.id);
            const placeholders = orderIds.map(() => '?').join(',');
            const [items] = await pool.query(
                `SELECT oi.order_id, oi.quantity, oi.price_at_time, m.name, m.preparation_time
                 FROM order_items oi
                 LEFT JOIN menu_items m ON oi.menu_item_id = m.id
                 WHERE oi.order_id IN (${placeholders})`,
                orderIds
            );
            const byOrder = items.reduce((acc, it) => {
                (acc[it.order_id] = acc[it.order_id] || []).push(it);
                return acc;
            }, {});
            orders.forEach(o => { o.items = byOrder[o.id] || []; });
        }

        const newOrders = orders.filter(o => ['pending', 'confirmed'].includes(o.order_status));
        const preparing = orders.filter(o => o.order_status === 'preparing');
        const ready = orders.filter(o => o.order_status === 'ready');

        const [[totalRow]] = await pool.query(
            'SELECT COUNT(*) AS c FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ?',
            [restaurantId, today]
        );
        const [[completedRow]] = await pool.query(
            `SELECT COUNT(*) AS c FROM orders
             WHERE restaurant_id = ? AND DATE(created_at) = ?
               AND order_status IN ('delivered', 'completed')`,
            [restaurantId, today]
        );

        res.json({
            new: newOrders,
            preparing,
            ready,
            stats: {
                totalToday: totalRow?.c || 0,
                completedToday: completedRow?.c || 0
            }
        });
    } catch (error) {
        console.error('Error fetching kitchen orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/orders/kitchen/:orderId/status - Kitchen status update (matches by numeric id)
router.post('/kitchen/:orderId/status', async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'delayed'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE orders SET order_status = ? WHERE id = ?',
            [status, req.params.orderId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ success: true, message: `Order status updated to ${status}` });
    } catch (error) {
        console.error('Error updating kitchen order status:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/orders/restaurant/:restaurantId/all - All orders
router.get('/restaurant/:restaurantId/all', async (req, res) => {
    try {
        const { restaurantId } = req.params;

        // Returns three name-related fields so we can diagnose where it's coming
        // from: raw_customer_name (DB column, exactly as POSTed), user_name (from
        // the linked user row), and customer_name (the resolved value the UI uses).
        const [orders] = await pool.query(
            `SELECT o.*,
                    o.customer_name AS raw_customer_name,
                    u.name AS user_name,
                    COALESCE(NULLIF(TRIM(o.customer_name), ''), NULLIF(TRIM(u.name), ''), 'Guest') AS customer_name
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.restaurant_id = ?
             ORDER BY o.created_at DESC`,
            [restaurantId]
        );

        res.json(orders);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/orders/:orderId/status - Update order status (alternative endpoint)
router.post('/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        await pool.query(
            'UPDATE orders SET order_status = ? WHERE id = ?',
            [status, orderId]
        );
        
        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
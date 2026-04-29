const { pool } = require('../config/db');

// Generate unique order ID
const generateOrderId = () => {
    return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
};

// Create new order
const createOrder = async (req, res) => {
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

    if (!restaurant_id || !items || items.length === 0) {
        return res.status(400).json({ error: 'Restaurant and items are required' });
    }

    const orderId = generateOrderId();

    try {
        await pool.query('START TRANSACTION');

        // Insert order
        const [orderResult] = await pool.query(
            `INSERT INTO orders (order_id, user_id, restaurant_id, order_type, subtotal, delivery_fee, tax, total_amount, 
             payment_method, delivery_address, table_number, pickup_time, customer_name, customer_phone, special_instructions, order_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [orderId, user_id || null, restaurant_id, order_type, subtotal, delivery_fee, tax, total_amount,
             payment_method, delivery_address, table_number, pickup_time, customer_name, customer_phone, special_instructions]
        );

        // Insert order items
        for (const item of items) {
            await pool.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES (?, ?, ?, ?)',
                [orderResult.insertId, item.menu_item_id, item.quantity, item.price_at_time]
            );
        }

        // Clear cart if user is logged in
        if (user_id) {
            await pool.query('DELETE FROM cart_items WHERE user_id = ?', [user_id]);
        }

        await pool.query('COMMIT');

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
};

// Get orders by user ID
const getOrdersByUser = async (req, res) => {
    const { userId } = req.params;

    try {
        const [orders] = await pool.query(
            `SELECT o.*, r.name as restaurant_name 
             FROM orders o 
             JOIN restaurants r ON o.restaurant_id = r.id 
             WHERE o.user_id = ? 
             ORDER BY o.created_at DESC`,
            [userId]
        );
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get orders by restaurant ID (for restaurant owners)
const getOrdersByRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    const { status, limit = 50 } = req.query;

    try {
        let query = `
            SELECT o.*, u.name as customer_name, u.phone as customer_phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.restaurant_id = ?
        `;
        const params = [restaurantId];

        if (status && status !== 'all') {
            query += ' AND o.order_status = ?';
            params.push(status);
        }

        query += ' ORDER BY o.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [orders] = await pool.query(query, params);
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching restaurant orders:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get single order by order_id
const getOrderById = async (req, res) => {
    const { orderId } = req.params;

    try {
        const [orders] = await pool.query(
            `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address 
             FROM orders o 
             JOIN restaurants r ON o.restaurant_id = r.id 
             WHERE o.order_id = ?`,
            [orderId]
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
};

// Update order status
const updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE orders SET order_status = ? WHERE order_id = ?',
            [status, orderId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ success: true, message: `Order status updated to ${status}` });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get order stats for dashboard
const getOrderStats = async (req, res) => {
    const { restaurantId } = req.params;
    const { period = 'today' } = req.query;

    let dateCondition = '';
    if (period === 'today') {
        dateCondition = 'AND DATE(created_at) = CURDATE()';
    } else if (period === 'week') {
        dateCondition = 'AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
        dateCondition = 'AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    try {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN order_status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN order_status = 'preparing' THEN 1 ELSE 0 END) as preparing_orders,
                SUM(CASE WHEN order_status = 'ready' THEN 1 ELSE 0 END) as ready_orders,
                SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
                SUM(total_amount) as total_revenue,
                AVG(total_amount) as avg_order_value
             FROM orders 
             WHERE restaurant_id = ? ${dateCondition}`,
            [restaurantId]
        );

        res.json({ success: true, stats: stats[0] });
    } catch (error) {
        console.error('Error fetching order stats:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createOrder,
    getOrdersByUser,
    getOrdersByRestaurant,
    getOrderById,
    updateOrderStatus,
    getOrderStats
};
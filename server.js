const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database connection
const { testConnection } = require('./config/db');

// Import routes
const restaurantRoutes = require('./routes/restaurantRoutes');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
const menuRoutes = require('./routes/menuRoutes');
const staffRoutes = require('./routes/staff');  // Staff management routes

const app = express();

// ============ MIDDLEWARE ============
// Comma-separated origins via CORS_ORIGINS env var, falling back to local dev origins.
// Same-origin requests (frontend served by nginx that proxies /api here) won't trigger CORS at all.
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:5173')
    .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-restaurant-id']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.url}`);
    next();
});

// ============ ROUTES ============

// Health check / Test route
app.get('/', (req, res) => {
    res.json({ 
        success: true,
        message: 'QRONOS API Running 🚀',
        version: '1.0.0',
        endpoints: {
            restaurants: '/api/restaurants',
            categories: '/api/restaurants/categories',
            menu: '/api/menu',
            auth: '/api/auth',
            orders: '/api/orders',
            cart: '/api/cart'
        }
    });
});

// API status route
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

// Register all routes
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth', staffRoutes);  // ✅ Staff routes register
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/menu', menuRoutes);

// ============ 404 HANDLER ============
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: `Route not found: ${req.method} ${req.url}` 
    });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.error('❌ Cannot start server without database connection');
        console.error('   Please fix database issues and try again');
        process.exit(1);
    }
    
    // Start listening
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on port ${PORT}`);
        console.log(`📍 API URL: http://localhost:${PORT}/api`);
        console.log(`\n📋 Available Endpoints:`);
        console.log(`   GET  /api/restaurants                    - Get all restaurants`);
        console.log(`   GET  /api/restaurants/:id                - Get restaurant by ID`);
        console.log(`   GET  /api/restaurants/categories         - Get all categories`);
        console.log(`   GET  /api/restaurants/:id/menu           - Get restaurant menu`);
        console.log(`   POST /api/auth/login                     - Restaurant staff login`);
        console.log(`   POST /api/auth/customer-login            - Customer login`);
        console.log(`   POST /api/auth/register                  - Customer register`);
        console.log(`   POST /api/auth/register-restaurant       - Register restaurant & owner`);
        console.log(`   GET  /api/auth/staff/restaurant/:id      - Get staff list`);
        console.log(`   GET  /api/auth/staff/restaurant/:id/count - Get staff count`);
        console.log(`   POST /api/auth/staff                     - Add staff member`);
        console.log(`   DELETE /api/auth/users/:id               - Delete staff`);
        console.log(`   POST /api/orders                         - Create order`);
        console.log(`   GET  /api/orders/user/:userId            - Get user orders`);
        console.log(`   GET  /api/orders/restaurant/:id/today    - Today's orders stats`);
        console.log(`   GET  /api/orders/restaurant/:id/all      - All orders`);
        console.log(`   POST /api/orders/:id/status              - Update order status`);
        console.log(`   GET  /api/cart/:userId                   - Get user cart`);
        console.log(`   POST /api/cart/add                       - Add to cart`);
        console.log(`   GET  /api/menu                           - Get menu items`);
        console.log(`   GET  /api/menu/restaurant/:id            - Get restaurant menu`);
        console.log(`   GET  /api/menu/restaurant/:id/count      - Get menu count`);
        console.log(`   POST /api/menu                           - Add menu item`);
        console.log(`   PUT  /api/menu/:id                       - Update menu item`);
        console.log(`   DELETE /api/menu/:id                     - Delete menu item`);
        console.log(`\n✨ Server ready!`);
    });
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

startServer();
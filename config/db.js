const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qronos_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test database connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ MySQL Database connection failed:', error.message);
        console.error('Please check:');
        console.error('  1. MySQL server is running');
        console.error('  2. Credentials in .env file are correct');
        console.error('  3. Database "qronos_db" exists');
        return false;
    }
};

// Execute query with error handling
const executeQuery = async (query, params = []) => {
    try {
        const [rows] = await pool.query(query, params);
        return { success: true, data: rows };
    } catch (error) {
        console.error('Query error:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { 
    pool, 
    testConnection, 
    executeQuery 
};
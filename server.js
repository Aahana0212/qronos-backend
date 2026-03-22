const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Simple load
dotenv.config();

console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD exists?', process.env.DB_PASSWORD ? 'Yes' : 'No');

const db = require('./config/db');

// Import routes - YE LINE IMPORTANT HAI
const menuRoutes = require('./routes/menuRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'QRONOS API Running' });
});

// Routes
app.use('/api/menu', menuRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const homeRoutes = require('./routes/homeRoutes');
app.use('/api/home', homeRoutes);

const orderRoutes = require('./routes/orderRoutes');
app.use('/api/orders', orderRoutes);

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const contactRoutes = require('./routes/contactRoutes');
app.use('/api/contact', contactRoutes);

const imageRoutes = require('./routes/imageRoutes');
app.use('/api/images', imageRoutes);
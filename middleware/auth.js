const jwt = require('jsonwebtoken');

// Authenticate JWT token
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            error: 'Access denied. No token provided.' 
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid token' 
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token expired' 
            });
        }
        return res.status(401).json({ 
            success: false, 
            error: 'Authentication failed' 
        });
    }
};

// Authorize based on roles
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Forbidden. You do not have permission to access this resource.' 
            });
        }

        next();
    };
};

// Check if user is restaurant owner or admin
const isRestaurantOwner = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            error: 'Only restaurant owners or admins can perform this action' 
        });
    }

    next();
};

// Check if user is kitchen staff
const isKitchenStaff = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (req.user.role !== 'kitchen' && req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            error: 'Only kitchen staff can access this resource' 
        });
    }

    next();
};

// Optional: Get user ID from token (for customer routes)
const getUserId = (req) => {
    return req.user ? req.user.id : null;
};

// Optional: Get restaurant ID from token (for restaurant routes)
const getRestaurantId = (req) => {
    return req.user ? req.user.restaurantId : null;
};

module.exports = { 
    authenticate, 
    authorize, 
    isRestaurantOwner, 
    isKitchenStaff,
    getUserId,
    getRestaurantId
};
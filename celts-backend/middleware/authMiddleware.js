// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify JWT and attach user data to the request.
 */
const protect = async (req, res, next) => {
  let token;

  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find user and attach to req (exclude password)
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      req.user = user;
      return next();
    }

    // If no header or startsWith not matched
    return res.status(401).json({ message: 'Not authorized, no token' });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

/**
 * Middleware to restrict access based on user role.
 * @param {string[]} roles - Array of roles allowed (e.g., ['admin','teacher'])
 */
const restrictTo = (roles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Access denied. User not authenticated.' });
  }
  if (!roles.includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: `Access denied. Requires one of the following roles: ${roles.join(', ')}` });
  }
  return next();
};

module.exports = { protect, restrictTo };

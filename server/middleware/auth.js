import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { cache } from '../utils/cache.js';

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Check if token is in cache (for performance)
    const cacheKey = `auth_token_${token}`;
    let decoded = cache.get(cacheKey);
    
    if (!decoded) {
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Cache the decoded token for 5 minutes
        cache.set(cacheKey, decoded, 300);
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token.'
        });
      }
    }
    
    // Check if user exists and is active
    const userCacheKey = `user_${decoded.userId}`;
    let user = cache.get(userCacheKey);
    
    if (!user) {
      user = await User.findById(decoded.userId).select('-password');
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive.'
        });
      }
      // Cache user for 2 minutes
      cache.set(userCacheKey, user, 120);
    }
    
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (jwtError) {
      // Token is invalid, but that's okay for optional auth
    }
    
    next();
    
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};
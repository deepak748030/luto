import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { cache } from '../utils/cache.js';

export const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Admin token required.'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        // Check if token is in cache
        const cacheKey = `admin_token_${token}`;
        let decoded = cache.get(cacheKey);

        if (!decoded) {
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
                // Cache the decoded token for 5 minutes
                cache.set(cacheKey, decoded, 300);
            } catch (jwtError) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid admin token.'
                });
            }
        }

        // Check if admin exists and is active
        const adminCacheKey = `admin_${decoded.adminId}`;
        let admin = cache.get(adminCacheKey);

        if (!admin) {
            admin = await Admin.findById(decoded.adminId);
            if (!admin || !admin.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Admin not found or inactive.'
                });
            }

            // Check if account is locked
            if (admin.isLocked) {
                return res.status(401).json({
                    success: false,
                    message: 'Admin account is temporarily locked due to multiple failed login attempts.'
                });
            }

            // Cache admin for 2 minutes
            cache.set(adminCacheKey, admin, 120);
        }

        req.admin = admin;
        next();

    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error.'
        });
    }
};

// Middleware to check specific permissions
export const checkPermission = (resource, action) => {
    return (req, res, next) => {
        const admin = req.admin;

        if (!admin.permissions[resource] || !admin.permissions[resource][action]) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Missing permission: ${resource}.${action}`
            });
        }

        next();
    };
};
import jwt from 'jsonwebtoken';

export const generateToken = (userId, type = 'user') => {
  return jwt.sign(
    type === 'admin' ? { adminId: userId } : { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
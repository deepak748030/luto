import express from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validation.js';
import { auth } from '../middleware/auth.js';
import {
  signup,
  verifyOtp,
  sendOtp,
  verifyOtpLogin,
  login,
  resendOtp,
  logout
} from '../controllers/authController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: User registration
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "John Doe"
 *               phone:
 *                 type: string
 *                 pattern: "^[6-9]\\d{9}$"
 *                 example: "9876543210"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         phone:
 *                           type: string
 *                         otpSent:
 *                           type: boolean
 *                         expiresIn:
 *                           type: string
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
// Signup
router.post('/signup', [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('phone')
    .custom((value) => {
      const cleanPhone = value.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanPhone) && !/^91[6-9]\d{9}$/.test(cleanPhone)) {
        throw new Error('Please enter a valid Indian mobile number');
      }
      return true;
    })
], validateRequest, signup);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and complete registration
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: "^[6-9]\\d{9}$"
 *                 example: "9876543210"
 *               otp:
 *                 type: string
 *                 pattern: "^\\d{6}$"
 *                 example: "123456"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         token:
 *                           type: string
 *                           description: JWT authentication token
 *       400:
 *         description: Invalid OTP or validation error
 */
// Verify OTP
router.post('/verify-otp', [
  body('phone')
    .custom((value) => {
      const cleanPhone = value.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanPhone) && !/^91[6-9]\d{9}$/.test(cleanPhone)) {
        throw new Error('Please enter a valid Indian mobile number');
      }
      return true;
    }),
  body('otp')
    .matches(/^\d{6}$/)
    .withMessage('OTP must be 6 digits'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], validateRequest, verifyOtp);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: "^[6-9]\\d{9}$"
 *                 example: "9876543210"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         token:
 *                           type: string
 *                           description: JWT authentication token
 *       401:
 *         description: Invalid credentials
 */
// Login
router.post('/login', [
  body('phone')
    .custom((value) => {
      const cleanPhone = value.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanPhone) && !/^91[6-9]\d{9}$/.test(cleanPhone)) {
        throw new Error('Please enter a valid Indian mobile number');
      }
      return true;
    }),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], validateRequest, login);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: "^[6-9]\\d{9}$"
 *                 example: "9876543210"
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Signup session not found
 */
// Resend OTP
router.post('/resend-otp', [
  body('phone')
    .custom((value) => {
      const cleanPhone = value.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanPhone) && !/^91[6-9]\d{9}$/.test(cleanPhone)) {
        throw new Error('Please enter a valid Indian mobile number');
      }
      return true;
    })
], validateRequest, resendOtp);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
// Logout (protected)
router.post('/logout', auth, logout);

export default router;
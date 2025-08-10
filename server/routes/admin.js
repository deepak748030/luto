import express from 'express';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../middleware/validation.js';
import { adminAuth } from '../middleware/adminAuth.js';
import {
    adminLogin,
    adminLogout,
    changeAdminPassword,
    getDashboardStats,
    getAllUsers,
    getUserDetails,
    blockUser,
    unblockUser,
    updateUserBalance,
    getAllRooms,
    getRoomDetails,
    declareCorrectWinner,
    cancelRoom,
    getAllTransactions,
    getTransactionDetails,
    processRefund,
    getSystemStats,
    getRevenueStats,
    getUserActivity,
    exportData,
    getWinnerRequests,
    getWinnerRequestDetails,
    approveWinnerRequest,
    rejectWinnerRequest,
    getWithdrawalRequests,
    getWithdrawalRequestDetails,
    approveWithdrawalRequest,
    rejectWithdrawalRequest
} from '../controllers/adminController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management endpoints
 */

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "admin123"
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials or account locked
 */
// Admin login (no auth required)
router.post('/login', [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
], validateRequest, adminLogin);

// All routes below require admin authentication
router.use(adminAuth);

/**
 * @swagger
 * /api/admin/logout:
 *   post:
 *     summary: Admin logout
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', adminLogout);

/**
 * @swagger
 * /api/admin/change-password:
 *   put:
 *     summary: Change admin password
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.put('/change-password', [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long')
], validateRequest, changeAdminPassword);

// Dashboard & Analytics
router.get('/dashboard/stats', getDashboardStats);
router.get('/system/stats', getSystemStats);
router.get('/revenue/stats', getRevenueStats);

// User Management
router.get('/users', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('status').optional().isIn(['all', 'active', 'blocked']),
    query('sortBy').optional().isIn(['createdAt', 'balance', 'totalGames', 'name']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
], validateRequest, getAllUsers);

router.get('/users/:userId', [
    param('userId').isMongoId().withMessage('Invalid user ID')
], validateRequest, getUserDetails);

router.put('/users/:userId/block', [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('reason').optional().trim()
], validateRequest, blockUser);

router.put('/users/:userId/unblock', [
    param('userId').isMongoId().withMessage('Invalid user ID')
], validateRequest, unblockUser);

router.put('/users/:userId/balance', [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('amount').isFloat().withMessage('Amount must be a number'),
    body('type').isIn(['add', 'deduct']).withMessage('Type must be add or deduct'),
    body('reason').trim().notEmpty().withMessage('Reason is required')
], validateRequest, updateUserBalance);

router.get('/users/:userId/activity', [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], validateRequest, getUserActivity);

// Room Management
router.get('/rooms', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['all', 'waiting', 'playing', 'completed', 'cancelled']),
    query('gameType').optional().isIn(['all', 'Ludo', 'Snakes & Ladders', 'Carrom']),
    query('sortBy').optional().isIn(['createdAt', 'amount', 'currentPlayers']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
], validateRequest, getAllRooms);

router.get('/rooms/:roomId', [
    param('roomId').notEmpty().withMessage('Room ID is required')
], validateRequest, getRoomDetails);

router.put('/rooms/:roomId/declare-winner', [
    param('roomId').notEmpty().withMessage('Room ID is required'),
    body('winnerId').isMongoId().withMessage('Invalid winner ID'),
    body('reason').trim().notEmpty().withMessage('Reason is required')
], validateRequest, declareCorrectWinner);

router.put('/rooms/:roomId/cancel', [
    param('roomId').notEmpty().withMessage('Room ID is required'),
    body('reason').trim().notEmpty().withMessage('Reason is required')
], validateRequest, cancelRoom);

// Transaction Management
router.get('/transactions', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['all', 'deposit', 'withdrawal', 'game_win', 'game_loss', 'refund']),
    query('status').optional().isIn(['all', 'pending', 'completed', 'failed', 'cancelled']),
    query('userId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('sortBy').optional().isIn(['createdAt', 'amount']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
], validateRequest, getAllTransactions);

router.get('/transactions/:transactionId', [
    param('transactionId').isMongoId().withMessage('Invalid transaction ID')
], validateRequest, getTransactionDetails);

router.post('/transactions/:transactionId/refund', [
    param('transactionId').isMongoId().withMessage('Invalid transaction ID'),
    body('reason').trim().notEmpty().withMessage('Reason is required')
], validateRequest, processRefund);

// Data Export
router.get('/export/:type', [
    param('type').isIn(['users', 'transactions', 'rooms']).withMessage('Invalid export type'),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
], validateRequest, exportData);

// Winner Verification Management
router.get('/winner-requests', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['all', 'pending', 'approved', 'rejected']),
    query('sortBy').optional().isIn(['createdAt', 'winnerAmount']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
], validateRequest, getWinnerRequests);

router.get('/winner-requests/:requestId', [
    param('requestId').isMongoId().withMessage('Invalid request ID')
], validateRequest, getWinnerRequestDetails);

router.put('/winner-requests/:requestId/approve', [
    param('requestId').isMongoId().withMessage('Invalid request ID'),
    body('notes').optional().trim()
], validateRequest, approveWinnerRequest);

router.put('/winner-requests/:requestId/reject', [
    param('requestId').isMongoId().withMessage('Invalid request ID'),
    body('reason').trim().notEmpty().withMessage('Rejection reason is required')
], validateRequest, rejectWinnerRequest);

// Withdrawal Request Management
/**
 * @swagger
 * /api/admin/withdrawal-requests:
 *   get:
 *     summary: Get all withdrawal requests
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, approved, rejected, cancelled]
 *           default: all
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, amount]
 *           default: createdAt
 *         description: Sort by field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Withdrawal requests retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/withdrawal-requests', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['all', 'pending', 'approved', 'rejected', 'cancelled']),
    query('sortBy').optional().isIn(['createdAt', 'amount']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
], validateRequest, getWithdrawalRequests);

/**
 * @swagger
 * /api/admin/withdrawal-requests/{requestId}:
 *   get:
 *     summary: Get withdrawal request details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Withdrawal request ID
 *     responses:
 *       200:
 *         description: Withdrawal request details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Withdrawal request not found
 */
router.get('/withdrawal-requests/:requestId', [
    param('requestId').isMongoId().withMessage('Invalid request ID')
], validateRequest, getWithdrawalRequestDetails);

/**
 * @swagger
 * /api/admin/withdrawal-requests/{requestId}/approve:
 *   put:
 *     summary: Approve withdrawal request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Withdrawal request ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Admin notes
 *               paymentProof:
 *                 type: string
 *                 description: Payment proof URL or reference
 *     responses:
 *       200:
 *         description: Withdrawal request approved successfully
 *       400:
 *         description: Cannot approve withdrawal request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Withdrawal request not found
 */
router.put('/withdrawal-requests/:requestId/approve', [
    param('requestId').isMongoId().withMessage('Invalid request ID'),
    body('notes').optional().trim(),
    body('paymentProof').optional().trim()
], validateRequest, approveWithdrawalRequest);

/**
 * @swagger
 * /api/admin/withdrawal-requests/{requestId}/reject:
 *   put:
 *     summary: Reject withdrawal request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Withdrawal request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Rejection reason
 *     responses:
 *       200:
 *         description: Withdrawal request rejected and amount refunded
 *       400:
 *         description: Cannot reject withdrawal request or missing reason
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Withdrawal request not found
 */
router.put('/withdrawal-requests/:requestId/reject', [
    param('requestId').isMongoId().withMessage('Invalid request ID'),
    body('reason').trim().notEmpty().withMessage('Rejection reason is required')
], validateRequest, rejectWithdrawalRequest);

export default router;
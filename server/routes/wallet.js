import express from 'express';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../middleware/validation.js';
import { auth } from '../middleware/auth.js';
import {
  getBalance,
  addMoney,
  withdraw,
  getTransactions,
  cancelWithdrawal,
  getWithdrawalRequests
} from '../controllers/walletController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Wallet management endpoints
 */

// All routes require authentication
router.use(auth);

/**
 * @swagger
 * /api/wallet/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
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
 *                         balance:
 *                           type: number
 *                           example: 1500.50
 *                         lastUpdated:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Unauthorized
 */
// Get balance
router.get('/balance', getBalance);

/**
 * @swagger
 * /api/wallet/add-money:
 *   post:
 *     summary: Add money to wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100000
 *                 example: 500
 *               paymentMethod:
 *                 type: string
 *                 enum: [fake, upi, card, netbanking]
 *                 default: fake
 *                 example: "upi"
 *     responses:
 *       200:
 *         description: Money added successfully
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
 *                         transaction:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             amount:
 *                               type: number
 *                             newBalance:
 *                               type: number
 *                             transactionId:
 *                               type: string
 *                             status:
 *                               type: string
 *       400:
 *         description: Invalid amount or payment failed
 *       401:
 *         description: Unauthorized
 */
// Add money
router.post('/add-money', [
  body('amount')
    .isFloat({ min: 1, max: 100000 })
    .withMessage('Amount must be between ₹1 and ₹1,00,000'),
  body('paymentMethod')
    .optional()
    .isIn(['fake', 'upi', 'card', 'netbanking'])
    .withMessage('Invalid payment method')
], validateRequest, addMoney);

/**
 * @swagger
 * /api/wallet/withdraw:
 *   post:
 *     summary: Withdraw money from wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - upiId
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 100
 *                 maximum: 50000
 *                 example: 1000
 *               upiId:
 *                 type: string
 *                 pattern: "^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$"
 *                 example: "user@paytm"
 *     responses:
 *       200:
 *         description: Withdrawal processed successfully
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
 *                         transaction:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             amount:
 *                               type: number
 *                             newBalance:
 *                               type: number
 *                             transactionId:
 *                               type: string
 *                             status:
 *                               type: string
 *                             upiId:
 *                               type: string
 *       400:
 *         description: Insufficient balance or invalid UPI ID
 *       401:
 *         description: Unauthorized
 */
// Withdraw money
router.post('/withdraw', [
  body('amount')
    .isFloat({ min: 100, max: 50000 })
    .withMessage('Amount must be between ₹100 and ₹50,000'),
  body('upiId')
    .matches(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/)
    .withMessage('Please enter a valid UPI ID')
], validateRequest, withdraw);

/**
 * @swagger
 * /api/wallet/withdrawal-requests:
 *   get:
 *     summary: Get user's withdrawal requests
 *     tags: [Wallet]
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
 *     responses:
 *       200:
 *         description: Withdrawal requests retrieved successfully
 *       401:
 *         description: Unauthorized
 */
// Get withdrawal requests
router.get('/withdrawal-requests', [
  query('status')
    .optional()
    .isIn(['all', 'pending', 'approved', 'rejected', 'cancelled'])
    .withMessage('Invalid status filter'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], validateRequest, getWithdrawalRequests);

/**
 * @swagger
 * /api/wallet/withdrawal-requests/{withdrawalId}/cancel:
 *   post:
 *     summary: Cancel withdrawal request
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: withdrawalId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Withdrawal request ID
 *     responses:
 *       200:
 *         description: Withdrawal cancelled successfully
 *       400:
 *         description: Cannot cancel withdrawal
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Withdrawal request not found
 */
// Cancel withdrawal request
router.post('/withdrawal-requests/:withdrawalId/cancel', [
  param('withdrawalId')
    .isMongoId()
    .withMessage('Invalid withdrawal ID')
], validateRequest, cancelWithdrawal);

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     summary: Get wallet transactions
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, deposit, withdrawal, game_win, game_loss, refund]
 *           default: all
 *         description: Filter by transaction type
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
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/PaginationResponse'
 *                         - type: object
 *                           properties:
 *                             data:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Unauthorized
 */
// Get transactions
router.get('/transactions', [
  query('type')
    .optional()
    .isIn(['all', 'deposit', 'withdrawal', 'game_win', 'game_loss', 'refund'])
    .withMessage('Invalid transaction type'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], validateRequest, getTransactions);

export default router;
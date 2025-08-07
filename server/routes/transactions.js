import express from 'express';
import { query, param } from 'express-validator';
import { validateRequest } from '../middleware/validation.js';
import { auth } from '../middleware/auth.js';
import {
  getTransactionHistory,
  getTransactionById,
  getTransactionStats
} from '../controllers/transactionController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction management endpoints
 */

// All routes require authentication
router.use(auth);

/**
 * @swagger
 * /api/transactions/history:
 *   get:
 *     summary: Get transaction history
 *     tags: [Transactions]
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
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date filter
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
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
 *                             summary:
 *                               type: object
 *                               properties:
 *                                 totalDeposits:
 *                                   type: number
 *                                 totalWithdrawals:
 *                                   type: number
 *                                 totalGameWinnings:
 *                                   type: number
 *                                 totalGameLosses:
 *                                   type: number
 *                                 totalRefunds:
 *                                   type: number
 *       401:
 *         description: Unauthorized
 */
// Get transaction history
router.get('/history', [
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
    .withMessage('Limit must be between 1 and 100'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO date')
], validateRequest, getTransactionHistory);

/**
 * @swagger
 * /api/transactions/stats:
 *   get:
 *     summary: Get transaction statistics
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Transaction statistics retrieved successfully
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
 *                         period:
 *                           type: string
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *                         summary:
 *                           type: object
 *                           additionalProperties:
 *                             type: object
 *                             properties:
 *                               totalAmount:
 *                                 type: number
 *                               totalCount:
 *                                 type: number
 *                               averageAmount:
 *                                 type: number
 *                         chartData:
 *                           type: object
 *                           additionalProperties:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 date:
 *                                   type: string
 *                                 amount:
 *                                   type: number
 *                                 count:
 *                                   type: number
 *       401:
 *         description: Unauthorized
 */
// Get transaction statistics
router.get('/stats', [
  query('period')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Invalid period. Must be 7d, 30d, 90d, or 1y')
], validateRequest, getTransactionStats);

/**
 * @swagger
 * /api/transactions/{transactionId}:
 *   get:
 *     summary: Get specific transaction details
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *           example: "60d5ecb74b24a1234567890a"
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details retrieved successfully
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
 *                           $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 */
// Get specific transaction
router.get('/:transactionId', [
  param('transactionId')
    .isMongoId()
    .withMessage('Invalid transaction ID')
], validateRequest, getTransactionById);

export default router;
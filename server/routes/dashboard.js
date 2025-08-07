import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  getDashboardStats,
  getQuickActions
} from '../controllers/dashboardController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard and analytics endpoints
 */

// All routes require authentication
router.use(auth);

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
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
 *                           description: Current wallet balance
 *                         stats:
 *                           type: object
 *                           properties:
 *                             totalGames:
 *                               type: number
 *                             totalWins:
 *                               type: number
 *                             totalWinnings:
 *                               type: number
 *                             winRate:
 *                               type: number
 *                         monthlyStats:
 *                           type: object
 *                           properties:
 *                             deposits:
 *                               type: number
 *                             withdrawals:
 *                               type: number
 *                             gameWinnings:
 *                               type: number
 *                             gameLosses:
 *                               type: number
 *                             gamesPlayed:
 *                               type: number
 *                         recentActivity:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               type:
 *                                 type: string
 *                               amount:
 *                                 type: number
 *                               description:
 *                                 type: string
 *                               roomId:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                               createdAt:
 *                                 type: string
 *                                 format: date-time
 *                         activeRooms:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               roomId:
 *                                 type: string
 *                               gameType:
 *                                 type: string
 *                               amount:
 *                                 type: number
 *                               currentPlayers:
 *                                 type: number
 *                               maxPlayers:
 *                                 type: number
 *                               status:
 *                                 type: string
 *                               isCreator:
 *                                 type: boolean
 *                               createdAt:
 *                                 type: string
 *                                 format: date-time
 *                         quickStats:
 *                           type: object
 *                           properties:
 *                             netProfitThisMonth:
 *                               type: number
 *                             totalDepositsThisMonth:
 *                               type: number
 *                             gamesPlayedThisMonth:
 *                               type: number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
// Get dashboard statistics
router.get('/stats', getDashboardStats);

/**
 * @swagger
 * /api/dashboard/quick-actions:
 *   get:
 *     summary: Get quick actions data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quick actions data retrieved successfully
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
 *                         quickActions:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               title:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                               icon:
 *                                 type: string
 *                               enabled:
 *                                 type: boolean
 *                               minAmount:
 *                                 type: number
 *                               maxAmount:
 *                                 type: number
 *                         suggestedAmounts:
 *                           type: array
 *                           items:
 *                             type: number
 *                           description: Popular game amounts user can afford
 *                         userBalance:
 *                           type: number
 *                           description: Current user balance
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
// Get quick actions
router.get('/quick-actions', getQuickActions);

export default router;
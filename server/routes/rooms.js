import express from 'express';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../middleware/validation.js';
import { auth } from '../middleware/auth.js';
import {
  getRooms,
  createRoom,
  joinRoom,
  declareWinner,
  getMyRooms,
  leaveRoom
} from '../controllers/roomController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Game Rooms
 *   description: Game room management endpoints
 */

// All routes require authentication
router.use(auth);

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: Get available game rooms
 *     tags: [Game Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, waiting, playing, completed, cancelled]
 *           default: all
 *         description: Filter by room status
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
 *           maximum: 50
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Rooms retrieved successfully
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
 *                                 allOf:
 *                                   - $ref: '#/components/schemas/GameRoom'
 *                                   - type: object
 *                                     properties:
 *                                       isJoined:
 *                                         type: boolean
 *                                         description: Whether current user has joined
 *                                       isCreator:
 *                                         type: boolean
 *                                         description: Whether current user is creator
 *       401:
 *         description: Unauthorized
 */
// Get all rooms
router.get('/', [
  query('status')
    .optional()
    .isIn(['all', 'waiting', 'playing', 'completed', 'cancelled'])
    .withMessage('Invalid status filter'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], validateRequest, getRooms);

/**
 * @swagger
 * /api/rooms/my-rooms:
 *   get:
 *     summary: Get user's game rooms
 *     tags: [Game Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, waiting, playing, completed, cancelled]
 *           default: all
 *         description: Filter by room status
 *     responses:
 *       200:
 *         description: User rooms retrieved successfully
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
 *                         rooms:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/GameRoom'
 *                               - type: object
 *                                 properties:
 *                                   isCreator:
 *                                     type: boolean
 *                                   isWinner:
 *                                     type: boolean
 *                                   userPosition:
 *                                     type: number
 *       401:
 *         description: Unauthorized
 */
// Get my rooms
router.get('/my-rooms', [
  query('status')
    .optional()
    .isIn(['all', 'waiting', 'playing', 'completed', 'cancelled'])
    .withMessage('Invalid status filter')
], validateRequest, getMyRooms);

/**
 * @swagger
 * /api/rooms/create:
 *   post:
 *     summary: Create a new game room
 *     tags: [Game Rooms]
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
 *               gameType:
 *                 type: string
 *                 enum: [Ludo, Snakes & Ladders, Carrom]
 *                 default: Ludo
 *                 example: "Ludo"
 *               amount:
 *                 type: number
 *                 minimum: 10
 *                 maximum: 10000
 *                 example: 100
 *               maxPlayers:
 *                 type: number
 *                 minimum: 2
 *                 maximum: 4
 *                 default: 4
 *                 example: 4
 *     responses:
 *       201:
 *         description: Room created successfully
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
 *                         room:
 *                           $ref: '#/components/schemas/GameRoom'
 *       400:
 *         description: Insufficient balance or invalid parameters
 *       401:
 *         description: Unauthorized
 */
// Create room
router.post('/create', [
  body('gameType')
    .optional()
    .isIn(['Ludo', 'Snakes & Ladders', 'Carrom'])
    .withMessage('Invalid game type'),
  body('amount')
    .isFloat({ min: 10, max: 10000 })
    .withMessage('Amount must be between ₹10 and ₹10,000'),
  body('maxPlayers')
    .optional()
    .isInt({ min: 2, max: 4 })
    .withMessage('Players must be between 2 and 4')
], validateRequest, createRoom);

/**
 * @swagger
 * /api/rooms/{roomId}/join:
 *   post:
 *     summary: Join a game room
 *     tags: [Game Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^LK[0-9]{6}$"
 *           example: "LK123456"
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Joined room successfully
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
 *                         room:
 *                           $ref: '#/components/schemas/GameRoom'
 *       400:
 *         description: Room full, insufficient balance, or already joined
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 */
// Join room
router.post('/:roomId/join', [
  param('roomId')
    .matches(/^LK[0-9]{6}$/)
    .withMessage('Invalid room ID format')
], validateRequest, joinRoom);

/**
 * @swagger
 * /api/rooms/{roomId}/declare-winner:
 *   put:
 *     summary: Declare winner of a game
 *     tags: [Game Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^LK[0-9]{6}$"
 *           example: "LK123456"
 *         description: Room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - winnerId
 *             properties:
 *               winnerId:
 *                 type: string
 *                 format: objectId
 *                 example: "60d5ecb74b24a1234567890a"
 *     responses:
 *       200:
 *         description: Winner declared successfully
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
 *                         room:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             roomId:
 *                               type: string
 *                             status:
 *                               type: string
 *                             winner:
 *                               type: string
 *                             completedAt:
 *                               type: string
 *                               format: date-time
 *                         winnings:
 *                           type: object
 *                           properties:
 *                             amount:
 *                               type: number
 *                             totalPrizePool:
 *                               type: number
 *                             platformFee:
 *                               type: number
 *       400:
 *         description: Game not in progress or invalid winner
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a player in this room
 *       404:
 *         description: Room not found
 */
// Declare winner
router.put('/:roomId/declare-winner', [
  param('roomId')
    .matches(/^LK[0-9]{6}$/)
    .withMessage('Invalid room ID format'),
  body('winnerId')
    .isMongoId()
    .withMessage('Invalid winner ID')
], validateRequest, declareWinner);

/**
 * @swagger
 * /api/rooms/{roomId}/leave:
 *   post:
 *     summary: Leave a game room
 *     tags: [Game Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^LK[0-9]{6}$"
 *           example: "LK123456"
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Left room successfully
 *       400:
 *         description: Cannot leave room once game has started or not in room
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 */
// Leave room
router.post('/:roomId/leave', [
  param('roomId')
    .matches(/^LK[0-9]{6}$/)
    .withMessage('Invalid room ID format')
], validateRequest, leaveRoom);

export default router;
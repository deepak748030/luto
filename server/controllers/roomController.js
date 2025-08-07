import GameRoom from '../models/GameRoom.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { cache, cacheUtils } from '../utils/cache.js';
import { getPagination, buildPaginationResponse, calculateWinnings } from '../utils/helpers.js';

export const getRooms = async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);

    // Build cache key
    const cacheKey = cacheUtils.roomsKey(status, currentPage);
    let cachedResult = cache.get(cacheKey);

    if (!cachedResult) {
      // Build query
      const query = {};
      if (status !== 'all') {
        query.status = status;
      }

      // Get rooms
      const [rooms, total] = await Promise.all([
        GameRoom.find(query)
          .populate('players.userId', 'name')
          .populate('createdBy', 'name')
          .populate('winner', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(currentLimit)
          .lean(),
        GameRoom.countDocuments(query)
      ]);

      cachedResult = buildPaginationResponse(rooms, total, currentPage, currentLimit);

      // Cache for 1 minute
      cache.set(cacheKey, cachedResult, 60);
    }

    // Add user participation info
    const roomsWithUserInfo = cachedResult.data.map(room => ({
      ...room,
      isJoined: room.players.some(player => player.userId._id.toString() === userId.toString()),
      isCreator: room.createdBy._id.toString() === userId.toString()
    }));

    res.status(200).json({
      success: true,
      data: {
        ...cachedResult,
        data: roomsWithUserInfo
      }
    });

  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rooms'
    });
  }
};

export const createRoom = async (req, res) => {
  try {
    const userId = req.user._id;
    const { gameType = 'Ludo', amount, maxPlayers = 4, roomCode } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    if (amount < 10 || amount > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between ₹10 and ₹10,000'
      });
    }

    // Validate room code if provided
    if (roomCode) {
      if (!/^[A-Z]{2}[0-9]{6}$/.test(roomCode)) {
        return res.status(400).json({
          success: false,
          message: 'Room code must be in format LK123456 (2 letters + 6 digits)'
        });
      }

      // Check if room code already exists
      const existingRoom = await GameRoom.findOne({ roomId: roomCode });
      if (existingRoom) {
        return res.status(400).json({
          success: false,
          message: 'Room code already exists. Please choose a different code.'
        });
      }
    }

    if (maxPlayers < 2 || maxPlayers > 4) {
      return res.status(400).json({
        success: false,
        message: 'Players must be between 2 and 4'
      });
    }

    // Check user balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance to create room'
      });
    }

    // Use provided room code or generate unique room ID
    let roomId = roomCode;
    if (!roomCode) {
      let attempts = 0;
      do {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        roomId = `LK${randomNum}`;
        attempts++;
      } while (await GameRoom.findOne({ roomId }) && attempts < 10);

      if (attempts >= 10) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate unique room ID'
        });
      }
    }

    // Deduct entry amount from user's wallet when creating room
    const session = await mongoose.startSession();

    let room;
    try {
      session.startTransaction();

      // Create transaction to deduct entry fee
      await Transaction.createWithBalanceUpdate(
        userId,
        'game_loss',
        amount,
        `Game Entry - Room ${roomId}`,
        {
          metadata: {
            roomCode: roomId,
            action: 'room_creation'
          }
        }
      );

      // Create room
      room = new GameRoom({
        roomId,
        gameType,
        amount,
        maxPlayers,
        createdBy: userId,
        players: [{
          userId,
          name: user.name,
          joinedAt: new Date()
        }]
      });

      await room.save({ session });
      await session.commitTransaction();

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    // Populate room data
    await room.populate([
      { path: 'players.userId', select: 'name' },
      { path: 'createdBy', select: 'name' }
    ]);

    // Clear caches
    cacheUtils.clearRoomsCache();
    cache.del(cacheUtils.balanceKey(userId));
    cacheUtils.clearUserCache(userId);

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: {
        room: {
          _id: room._id,
          roomId: room.roomId,
          gameType: room.gameType,
          amount: room.amount,
          maxPlayers: room.maxPlayers,
          currentPlayers: room.currentPlayers,
          players: room.players,
          status: room.status,
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          isCreator: true,
          isJoined: true
        }
      }
    });

  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create room'
    });
  }
};

export const joinRoom = async (req, res) => {
  try {
    const userId = req.user._id;
    const { roomId } = req.params;

    // Find room
    const room = await GameRoom.findOne({ roomId })
      .populate('players.userId', 'name')
      .populate('createdBy', 'name');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user already in room
    if (room.hasPlayer(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already in this room'
      });
    }

    // Check room status
    if (room.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: 'Cannot join room that is not waiting for players'
      });
    }

    // Check if room is full
    if (room.isFull) {
      return res.status(400).json({
        success: false,
        message: 'Room is full'
      });
    }

    // Check user balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.balance < room.amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance to join room'
      });
    }

    // Deduct entry fee and add player to room
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Deduct entry fee from joining user
      await Transaction.createWithBalanceUpdate(
        userId,
        'game_loss',
        room.amount,
        `Game Entry - Room ${room.roomId}`,
        {
          gameRoomId: room._id,
          metadata: {
            roomCode: room.roomId,
            action: 'room_join'
          }
        }
      );

      // Add player to room
      room.addPlayer(userId, user.name);

      // If room is now full, start the game
      if (room.isFull) {
        room.startGame();
      }

      await room.save({ session });
      await session.commitTransaction();

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    // Clear caches
    cacheUtils.clearRoomsCache();
    cache.del(cacheUtils.balanceKey(userId));
    cacheUtils.clearUserCache(userId);

    res.status(200).json({
      success: true,
      message: room.status === 'playing' ? 'Joined room and game started!' : 'Joined room successfully',
      data: {
        room: {
          _id: room._id,
          roomId: room.roomId,
          gameType: room.gameType,
          amount: room.amount,
          maxPlayers: room.maxPlayers,
          currentPlayers: room.currentPlayers,
          players: room.players,
          status: room.status,
          startedAt: room.startedAt,
          totalPrizePool: room.totalPrizePool,
          winnerAmount: room.winnerAmount
        }
      }
    });

  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to join room'
    });
  }
};

export const declareWinner = async (req, res) => {
  try {
    const userId = req.user._id;
    const { roomId } = req.params;
    const { winnerId } = req.body;

    if (!winnerId) {
      return res.status(400).json({
        success: false,
        message: 'Winner ID is required'
      });
    }

    // Find room
    const room = await GameRoom.findOne({ roomId })
      .populate('players.userId', 'name')
      .populate('createdBy', 'name');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is in the room
    if (!room.hasPlayer(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a player in this room'
      });
    }

    // Check room status
    if (room.status !== 'playing') {
      return res.status(400).json({
        success: false,
        message: 'Game is not in progress'
      });
    }

    // Check if winner is in the room
    if (!room.hasPlayer(winnerId)) {
      return res.status(400).json({
        success: false,
        message: 'Winner must be a player in the room'
      });
    }

    // Complete the game
    room.completeGame(winnerId);
    await room.save();

    // Award winnings to winner
    const winner = await User.findById(winnerId);
    await Transaction.createWithBalanceUpdate(
      winnerId,
      'game_win',
      room.winnerAmount,
      `Game Won - Room ${room.roomId}`,
      {
        gameRoomId: room._id,
        metadata: {
          roomCode: room.roomId,
          totalPlayers: room.players.length,
          prizePool: room.totalPrizePool,
          platformFee: room.platformFee
        }
      }
    );

    // Update winner's game stats
    await winner.incrementGameStats(true, room.winnerAmount);

    // Update other players' stats (losses)
    for (const player of room.players) {
      if (player.userId.toString() !== winnerId.toString()) {
        const playerUser = await User.findById(player.userId);
        await playerUser.incrementGameStats(false, 0);
      }
    }

    // Clear caches
    cacheUtils.clearRoomsCache();
    for (const player of room.players) {
      cache.del(cacheUtils.balanceKey(player.userId));
      cacheUtils.clearUserCache(player.userId);
    }

    res.status(200).json({
      success: true,
      message: 'Winner declared successfully',
      data: {
        room: {
          _id: room._id,
          roomId: room.roomId,
          status: room.status,
          winner: room.winner,
          completedAt: room.completedAt
        },
        winnings: {
          amount: room.winnerAmount,
          totalPrizePool: room.totalPrizePool,
          platformFee: room.platformFee
        }
      }
    });

  } catch (error) {
    console.error('Declare winner error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to declare winner'
    });
  }
};

export const getMyRooms = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status = 'all' } = req.query;

    // Build cache key
    const cacheKey = cacheUtils.userRoomsKey(userId, status);
    let cachedResult = cache.get(cacheKey);

    if (!cachedResult) {
      // Build query
      const query = {
        'players.userId': userId
      };

      if (status !== 'all') {
        query.status = status;
      }

      // Get user's rooms
      const rooms = await GameRoom.find(query)
        .populate('players.userId', 'name')
        .populate('createdBy', 'name')
        .populate('winner', 'name')
        .sort({ createdAt: -1 })
        .lean();

      cachedResult = rooms;

      // Cache for 2 minutes
      cache.set(cacheKey, cachedResult, 120);
    }

    // Add user-specific info
    const roomsWithUserInfo = cachedResult.map(room => ({
      ...room,
      isCreator: room.createdBy._id.toString() === userId.toString(),
      isWinner: room.winner?._id.toString() === userId.toString(),
      userPosition: room.players.findIndex(p => p.userId._id.toString() === userId.toString()) + 1
    }));

    res.status(200).json({
      success: true,
      data: {
        rooms: roomsWithUserInfo
      }
    });

  } catch (error) {
    console.error('Get my rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get your rooms'
    });
  }
};

export const leaveRoom = async (req, res) => {
  try {
    const userId = req.user._id;
    const { roomId } = req.params;

    // Find room
    const room = await GameRoom.findOne({ roomId });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is in room
    if (!room.hasPlayer(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not in this room'
      });
    }

    // Can only leave if room is waiting
    if (room.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave room once game has started'
      });
    }

    // Remove player from room
    room.players = room.players.filter(
      player => player.userId.toString() !== userId.toString()
    );

    // If creator leaves, transfer ownership or cancel room
    if (room.createdBy.toString() === userId.toString()) {
      if (room.players.length > 0) {
        room.createdBy = room.players[0].userId;
      } else {
        room.status = 'cancelled';
      }
    }

    await room.save();

    // Clear caches
    cacheUtils.clearRoomsCache();
    cache.del(cacheUtils.userRoomsKey(userId));

    res.status(200).json({
      success: true,
      message: 'Left room successfully'
    });

  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave room'
    });
  }
};
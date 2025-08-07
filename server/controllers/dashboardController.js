import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import GameRoom from '../models/GameRoom.js';
import { cache, cacheUtils } from '../utils/cache.js';

export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Try to get stats from cache first
    const cacheKey = cacheUtils.statsKey(userId);
    let cachedStats = cache.get(cacheKey);
    
    if (!cachedStats) {
      // Get user data
      const user = await User.findById(userId).select('-password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Get recent transactions (last 5)
      const recentTransactions = await Transaction.find({ userId })
        .populate({
          path: 'gameRoomId',
          select: 'roomId'
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      
      // Get active rooms where user is participating
      const activeRooms = await GameRoom.find({
        'players.userId': userId,
        status: { $in: ['waiting', 'playing'] }
      })
      .populate('players.userId', 'name')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
      
      // Calculate this month's statistics
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      const monthlyStats = await Transaction.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: currentMonth },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Format monthly stats
      const monthlyData = {
        deposits: 0,
        withdrawals: 0,
        gameWinnings: 0,
        gameLosses: 0,
        gamesPlayed: 0
      };
      
      monthlyStats.forEach(stat => {
        switch (stat._id) {
          case 'deposit':
            monthlyData.deposits = stat.total;
            break;
          case 'withdrawal':
            monthlyData.withdrawals = stat.total;
            break;
          case 'game_win':
            monthlyData.gameWinnings = stat.total;
            break;
          case 'game_loss':
            monthlyData.gameLosses = stat.total;
            monthlyData.gamesPlayed = stat.count;
            break;
        }
      });
      
      // Format recent activity
      const recentActivity = recentTransactions.map(transaction => ({
        _id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        roomId: transaction.gameRoomId?.roomId,
        status: transaction.status,
        createdAt: transaction.createdAt
      }));
      
      // Format active rooms
      const userActiveRooms = activeRooms.map(room => ({
        _id: room._id,
        roomId: room.roomId,
        gameType: room.gameType,
        amount: room.amount,
        currentPlayers: room.players.length,
        maxPlayers: room.maxPlayers,
        status: room.status,
        isCreator: room.createdBy.toString() === userId.toString(),
        createdAt: room.createdAt
      }));
      
      cachedStats = {
        balance: user.balance,
        stats: {
          totalGames: user.totalGames,
          totalWins: user.totalWins,
          totalWinnings: user.totalWinnings,
          winRate: user.winRate
        },
        monthlyStats: monthlyData,
        recentActivity,
        activeRooms: userActiveRooms,
        quickStats: {
          netProfitThisMonth: monthlyData.gameWinnings - monthlyData.gameLosses,
          totalDepositsThisMonth: monthlyData.deposits,
          gamesPlayedThisMonth: monthlyData.gamesPlayed
        }
      };
      
      // Cache stats for 5 minutes
      cache.set(cacheKey, cachedStats, 300);
    }
    
    res.status(200).json({
      success: true,
      data: cachedStats
    });
    
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics'
    });
  }
};

export const getQuickActions = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user balance
    const user = await User.findById(userId).select('balance');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get available quick actions based on user balance and status
    const quickActions = [
      {
        id: 'add_money',
        title: 'Add Money',
        description: 'Add funds to your wallet',
        icon: 'wallet',
        enabled: true,
        minAmount: 10,
        maxAmount: 100000
      },
      {
        id: 'withdraw',
        title: 'Withdraw',
        description: 'Withdraw to your UPI',
        icon: 'banknote',
        enabled: user.balance >= 100,
        minAmount: 100,
        maxAmount: Math.min(user.balance, 50000)
      },
      {
        id: 'create_room',
        title: 'Create Room',
        description: 'Start a new game',
        icon: 'plus-circle',
        enabled: user.balance >= 10,
        minAmount: 10,
        maxAmount: Math.min(user.balance, 10000)
      },
      {
        id: 'join_room',
        title: 'Join Room',
        description: 'Join existing game',
        icon: 'users',
        enabled: user.balance >= 10
      }
    ];
    
    // Get recent popular game amounts
    const popularAmounts = await GameRoom.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'playing'] },
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        }
      },
      {
        $group: {
          _id: '$amount',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 6
      }
    ]);
    
    const suggestedAmounts = popularAmounts
      .map(item => item._id)
      .filter(amount => amount <= user.balance)
      .slice(0, 4);
    
    // Add default amounts if not enough popular amounts
    if (suggestedAmounts.length < 4) {
      const defaultAmounts = [50, 100, 250, 500, 1000];
      for (const amount of defaultAmounts) {
        if (suggestedAmounts.length >= 4) break;
        if (amount <= user.balance && !suggestedAmounts.includes(amount)) {
          suggestedAmounts.push(amount);
        }
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        quickActions,
        suggestedAmounts: suggestedAmounts.sort((a, b) => a - b),
        userBalance: user.balance
      }
    });
    
  } catch (error) {
    console.error('Get quick actions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quick actions'
    });
  }
};
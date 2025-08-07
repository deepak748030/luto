import Transaction from '../models/Transaction.js';
import GameRoom from '../models/GameRoom.js';
import { cache, cacheUtils } from '../utils/cache.js';
import { getPagination, buildPaginationResponse } from '../utils/helpers.js';

export const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type = 'all', page = 1, limit = 20, startDate, endDate } = req.query;
    
    const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);
    
    // Build cache key
    const cacheKey = `transaction_history_${userId}_${type}_${currentPage}_${startDate || 'all'}_${endDate || 'all'}`;
    let cachedResult = cache.get(cacheKey);
    
    if (!cachedResult) {
      // Build query
      const query = { userId };
      
      if (type !== 'all') {
        query.type = type;
      }
      
      // Date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }
      
      // Get transactions with populated game room data
      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .populate({
            path: 'gameRoomId',
            select: 'roomId gameType status'
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(currentLimit)
          .lean(),
        Transaction.countDocuments(query)
      ]);
      
      // Calculate summary statistics
      const summaryPipeline = [
        { $match: { userId } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ];
      
      const summaryData = await Transaction.aggregate(summaryPipeline);
      
      const summary = {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalGameWinnings: 0,
        totalGameLosses: 0,
        totalRefunds: 0
      };
      
      summaryData.forEach(item => {
        switch (item._id) {
          case 'deposit':
            summary.totalDeposits = item.total;
            break;
          case 'withdrawal':
            summary.totalWithdrawals = item.total;
            break;
          case 'game_win':
            summary.totalGameWinnings = item.total;
            break;
          case 'game_loss':
            summary.totalGameLosses = item.total;
            break;
          case 'refund':
            summary.totalRefunds = item.total;
            break;
        }
      });
      
      // Format transactions
      const formattedTransactions = transactions.map(transaction => ({
        _id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        status: transaction.status,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        transactionId: transaction.transactionId,
        upiId: transaction.upiId,
        paymentId: transaction.paymentId,
        orderId: transaction.orderId,
        processingFee: transaction.processingFee,
        gameRoom: transaction.gameRoomId ? {
          roomId: transaction.gameRoomId.roomId,
          gameType: transaction.gameRoomId.gameType,
          status: transaction.gameRoomId.status
        } : null,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt
      }));
      
      cachedResult = {
        ...buildPaginationResponse(formattedTransactions, total, currentPage, currentLimit),
        summary
      };
      
      // Cache for 3 minutes
      cache.set(cacheKey, cachedResult, 180);
    }
    
    res.status(200).json({
      success: true,
      data: cachedResult
    });
    
  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction history'
    });
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { transactionId } = req.params;
    
    // Find transaction
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId
    }).populate({
      path: 'gameRoomId',
      select: 'roomId gameType players winner status createdAt completedAt',
      populate: [
        { path: 'players.userId', select: 'name' },
        { path: 'winner', select: 'name' }
      ]
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    // Format transaction details
    const formattedTransaction = {
      _id: transaction._id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      status: transaction.status,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      transactionId: transaction.transactionId,
      upiId: transaction.upiId,
      paymentId: transaction.paymentId,
      orderId: transaction.orderId,
      processingFee: transaction.processingFee,
      gameRoom: transaction.gameRoomId,
      metadata: transaction.metadata,
      createdAt: transaction.createdAt
    };
    
    res.status(200).json({
      success: true,
      data: {
        transaction: formattedTransaction
      }
    });
    
  } catch (error) {
    console.error('Get transaction by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction details'
    });
  }
};

export const getTransactionStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = '30d' } = req.query;
    
    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }
    
    const cacheKey = `transaction_stats_${userId}_${period}`;
    let cachedStats = cache.get(cacheKey);
    
    if (!cachedStats) {
      // Aggregate transaction stats
      const statsAggregation = [
        {
          $match: {
            userId,
            createdAt: { $gte: startDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              type: '$type',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt'
                }
              }
            },
            amount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.type',
            totalAmount: { $sum: '$amount' },
            totalCount: { $sum: '$count' },
            dailyData: {
              $push: {
                date: '$_id.date',
                amount: '$amount',
                count: '$count'
              }
            }
          }
        }
      ];
      
      const stats = await Transaction.aggregate(statsAggregation);
      
      // Format stats
      cachedStats = {
        period,
        startDate,
        endDate: new Date(),
        summary: {},
        chartData: {}
      };
      
      stats.forEach(stat => {
        cachedStats.summary[stat._id] = {
          totalAmount: stat.totalAmount,
          totalCount: stat.totalCount,
          averageAmount: Math.round(stat.totalAmount / stat.totalCount)
        };
        cachedStats.chartData[stat._id] = stat.dailyData;
      });
      
      // Cache for 10 minutes
      cache.set(cacheKey, cachedStats, 600);
    }
    
    res.status(200).json({
      success: true,
      data: cachedStats
    });
    
  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction statistics'
    });
  }
};
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { PaymentService } from '../services/paymentService.js';
import { cache, cacheUtils } from '../utils/cache.js';
import { getPagination, buildPaginationResponse } from '../utils/helpers.js';

export const getBalance = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Try to get balance from cache first
    let balance = cache.get(cacheUtils.balanceKey(userId));
    
    if (balance === undefined) {
      const user = await User.findById(userId).select('balance');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      balance = user.balance;
      // Cache balance for 2 minutes
      cache.set(cacheUtils.balanceKey(userId), balance, 120);
    }
    
    res.status(200).json({
      success: true,
      data: {
        balance,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get balance'
    });
  }
};

export const addMoney = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, paymentMethod = 'fake' } = req.body;
    
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }
    
    if (amount > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum deposit amount is ₹1,00,000'
      });
    }
    
    // Create fake payment order
    const paymentOrder = await PaymentService.createOrder(amount, 'INR', userId);
    
    // For testing, directly verify the payment (fake success)
    const paymentVerification = await PaymentService.verifyPayment(
      paymentOrder.orderId,
      `pay_${Date.now()}`,
      'fake_signature'
    );
    
    if (!paymentVerification.verified) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
    
    // Create transaction and update balance
    const transaction = await Transaction.createWithBalanceUpdate(
      userId,
      'deposit',
      amount,
      'Money Added to Wallet',
      {
        paymentId: paymentVerification.paymentId,
        orderId: paymentOrder.orderId,
        metadata: {
          paymentMethod
        }
      }
    );
    
    // Clear balance cache
    cache.del(cacheUtils.balanceKey(userId));
    cacheUtils.clearUserCache(userId);
    
    res.status(200).json({
      success: true,
      message: 'Money added successfully',
      data: {
        transaction: {
          _id: transaction._id,
          amount: transaction.amount,
          newBalance: transaction.balanceAfter,
          transactionId: transaction.transactionId,
          status: transaction.status
        }
      }
    });
    
  } catch (error) {
    console.error('Add money error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add money'
    });
  }
};

export const withdraw = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, upiId } = req.body;
    
    // Validate input
    if (!amount || !upiId) {
      return res.status(400).json({
        success: false,
        message: 'Amount and UPI ID are required'
      });
    }
    
    // Validate amount
    const minAmount = parseInt(process.env.MIN_WITHDRAWAL_AMOUNT) || 100;
    const maxAmount = parseInt(process.env.MAX_WITHDRAWAL_AMOUNT) || 50000;
    
    if (amount < minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ₹${minAmount}`
      });
    }
    
    if (amount > maxAmount) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal amount is ₹${maxAmount}`
      });
    }
    
    // Validate UPI ID format
    if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upiId)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid UPI ID'
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
        message: 'Insufficient balance'
      });
    }
    
    // Create withdrawal transaction
    const transaction = await Transaction.createWithBalanceUpdate(
      userId,
      'withdrawal',
      amount,
      'Withdrawal to UPI',
      {
        upiId,
        status: 'pending'
      }
    );
    
    // Process withdrawal (fake for testing)
    try {
      await PaymentService.processWithdrawal(upiId, amount, transaction.transactionId);
      transaction.status = 'completed';
      await transaction.save();
    } catch (withdrawalError) {
      transaction.status = 'failed';
      transaction.metadata = {
        ...transaction.metadata,
        failureReason: withdrawalError.message
      };
      await transaction.save();
      
      // Refund the amount
      await Transaction.createWithBalanceUpdate(
        userId,
        'refund',
        amount,
        'Withdrawal refund - processing failed',
        {
          gameRoomId: null,
          metadata: {
            originalTransactionId: transaction._id
          }
        }
      );
    }
    
    // Clear caches
    cache.del(cacheUtils.balanceKey(userId));
    cacheUtils.clearUserCache(userId);
    
    res.status(200).json({
      success: true,
      message: transaction.status === 'completed' 
        ? 'Withdrawal processed successfully' 
        : 'Withdrawal request submitted',
      data: {
        transaction: {
          _id: transaction._id,
          amount: transaction.amount,
          newBalance: transaction.balanceAfter,
          transactionId: transaction.transactionId,
          status: transaction.status,
          upiId: transaction.upiId
        }
      }
    });
    
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process withdrawal'
    });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type = 'all', page = 1, limit = 20 } = req.query;
    
    const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);
    
    // Build cache key
    const cacheKey = cacheUtils.transactionsKey(userId, type, currentPage);
    let cachedResult = cache.get(cacheKey);
    
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        data: cachedResult
      });
    }
    
    // Build query
    const query = { userId };
    if (type !== 'all') {
      query.type = type;
    }
    
    // Get transactions
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('gameRoomId', 'roomId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      Transaction.countDocuments(query)
    ]);
    
    // Format transactions
    const formattedTransactions = transactions.map(transaction => ({
      _id: transaction._id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      status: transaction.status,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      upiId: transaction.upiId,
      transactionId: transaction.transactionId,
      roomCode: transaction.gameRoomId?.roomId,
      createdAt: transaction.createdAt,
      metadata: transaction.metadata
    }));
    
    const result = buildPaginationResponse(
      formattedTransactions, 
      total, 
      currentPage, 
      currentLimit
    );
    
    // Cache result for 2 minutes
    cache.set(cacheKey, result, 120);
    
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transactions'
    });
  }
};
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
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

    // Check if user has any pending withdrawal requests
    const pendingWithdrawal = await WithdrawalRequest.findOne({
      userId,
      status: 'pending'
    });

    if (pendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request. Please wait for it to be processed or cancel it first.'
      });
    }

    // Create withdrawal transaction and deduct balance immediately
    const transaction = await Transaction.createWithBalanceUpdate(
      userId,
      'withdrawal',
      amount,
      `Withdrawal request to ${upiId}`,
      {
        upiId,
        status: 'pending'
      }
    );

    // Create withdrawal request for admin approval
    const withdrawalRequest = new WithdrawalRequest({
      userId,
      transactionId: transaction._id,
      amount,
      upiId,
      userInfo: {
        name: user.name,
        phone: user.phone
      }
    });

    await withdrawalRequest.save();

    // Clear caches
    cache.del(cacheUtils.balanceKey(userId));
    cacheUtils.clearUserCache(userId);

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully. Your request is pending admin approval.',
      data: {
        withdrawalRequest: {
          _id: withdrawalRequest._id,
          amount: withdrawalRequest.amount,
          upiId: withdrawalRequest.upiId,
          status: withdrawalRequest.status,
          requestedAt: withdrawalRequest.requestedAt
        },
        transaction: {
          _id: transaction._id,
          amount: transaction.amount,
          newBalance: transaction.balanceAfter,
          transactionId: transaction.transactionId,
          status: transaction.status,
          upiId: transaction.upiId
        },
        message: 'Amount has been deducted from your wallet. You will receive the money once admin approves your request.'
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

export const cancelWithdrawal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { withdrawalId } = req.params;

    // Find withdrawal request
    const withdrawalRequest = await WithdrawalRequest.findOne({
      _id: withdrawalId,
      userId
    });

    if (!withdrawalRequest) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    if (withdrawalRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending withdrawal requests can be cancelled'
      });
    }

    // Cancel withdrawal and refund amount
    await withdrawalRequest.cancel();

    // Clear caches
    cache.del(cacheUtils.balanceKey(userId));
    cacheUtils.clearUserCache(userId);

    res.status(200).json({
      success: true,
      message: 'Withdrawal request cancelled successfully. Amount has been refunded to your wallet.',
      data: {
        withdrawalRequest: {
          _id: withdrawalRequest._id,
          status: withdrawalRequest.status,
          processedAt: withdrawalRequest.processedAt
        }
      }
    });

  } catch (error) {
    console.error('Cancel withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel withdrawal'
    });
  }
};

export const getWithdrawalRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status = 'all', page = 1, limit = 20 } = req.query;

    const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);

    // Build query
    const query = { userId };
    if (status !== 'all') {
      query.status = status;
    }

    // Get withdrawal requests
    const [withdrawalRequests, total] = await Promise.all([
      WithdrawalRequest.find(query)
        .populate('processedBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      WithdrawalRequest.countDocuments(query)
    ]);

    const result = buildPaginationResponse(
      withdrawalRequests,
      total,
      currentPage,
      currentLimit
    );

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get withdrawal requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get withdrawal requests'
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
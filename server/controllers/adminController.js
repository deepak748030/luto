import Admin from '../models/Admin.js';
import User from '../models/User.js';
import GameRoom from '../models/GameRoom.js';
import Transaction from '../models/Transaction.js';
import WinnerRequest from '../models/WinnerRequest.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import { generateToken } from '../utils/jwt.js';
import { cache, cacheUtils } from '../utils/cache.js';
import { getPagination, buildPaginationResponse } from '../utils/helpers.js';
import mongoose from 'mongoose';

// Admin Authentication
export const adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find admin
        const admin = await Admin.findOne({ username, isActive: true });
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if account is locked
        if (admin.isLocked) {
            return res.status(401).json({
                success: false,
                message: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
            });
        }

        // Verify password
        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            await admin.incLoginAttempts();
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Reset login attempts on successful login
        if (admin.loginAttempts > 0) {
            await admin.resetLoginAttempts();
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        // Generate JWT token
        const token = generateToken(admin._id, 'admin');

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                admin: {
                    _id: admin._id,
                    username: admin.username,
                    role: admin.role,
                    permissions: admin.permissions
                },
                token
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
};

export const adminLogout = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Admin logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
};

export const changeAdminPassword = async (req, res) => {
    try {
        const adminId = req.admin._id;
        const { currentPassword, newPassword } = req.body;

        // Find admin
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        admin.password = newPassword;
        await admin.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change admin password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
};

// Dashboard & Analytics
export const getDashboardStats = async (req, res) => {
    try {
        const cacheKey = 'admin_dashboard_stats';
        let cachedStats = cache.get(cacheKey);

        if (!cachedStats) {
            // Get current date ranges
            const today = new Date();
            const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfYear = new Date(today.getFullYear(), 0, 1);

            // Get basic counts
            const [
                totalUsers,
                activeUsers,
                totalRooms,
                activeRooms,
                pendingWithdrawals,
                pendingWinnerRequests
            ] = await Promise.all([
                User.countDocuments({ isActive: true }),
                User.countDocuments({
                    isActive: true,
                    lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }),
                GameRoom.countDocuments(),
                GameRoom.countDocuments({ status: { $in: ['waiting', 'playing'] } }),
                WithdrawalRequest.countDocuments({ status: 'pending' }),
                WinnerRequest.countDocuments({ status: 'pending' })
            ]);

            // Get transaction stats
            const transactionStats = await Transaction.aggregate([
                {
                    $match: {
                        status: 'completed',
                        createdAt: { $gte: startOfMonth }
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

            // Format transaction stats
            const monthlyStats = {
                deposits: 0,
                withdrawals: 0,
                gameRevenue: 0,
                totalTransactions: 0
            };

            transactionStats.forEach(stat => {
                monthlyStats.totalTransactions += stat.count;
                switch (stat._id) {
                    case 'deposit':
                        monthlyStats.deposits = stat.total;
                        break;
                    case 'withdrawal':
                        monthlyStats.withdrawals = stat.total;
                        break;
                    case 'game_loss':
                        // Platform fee from game losses (10% of total game amount)
                        monthlyStats.gameRevenue += Math.floor(stat.total * 0.1);
                        break;
                }
            });

            // Get recent activities
            const recentTransactions = await Transaction.find({
                status: 'completed'
            })
                .populate('userId', 'name phone')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            cachedStats = {
                overview: {
                    totalUsers,
                    activeUsers,
                    totalRooms,
                    activeRooms,
                    pendingWithdrawals,
                    pendingWinnerRequests
                },
                monthlyStats,
                recentTransactions: recentTransactions.map(t => ({
                    _id: t._id,
                    type: t.type,
                    amount: t.amount,
                    user: t.userId,
                    createdAt: t.createdAt
                }))
            };

            // Cache for 5 minutes
            cache.set(cacheKey, cachedStats, 300);
        }

        res.status(200).json({
            success: true,
            data: cachedStats
        });

    } catch (error) {
        console.error('Get admin dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get dashboard statistics'
        });
    }
};

// Withdrawal Management
export const getWithdrawalRequests = async (req, res) => {
    try {
        const { status = 'all', page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);

        // Build query
        const query = {};
        if (status !== 'all') {
            query.status = status;
        }

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Get withdrawal requests
        const [withdrawalRequests, total] = await Promise.all([
            WithdrawalRequest.find(query)
                .populate('userId', 'name phone balance')
                .populate('processedBy', 'username')
                .sort(sort)
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

export const getWithdrawalRequestDetails = async (req, res) => {
    try {
        const { requestId } = req.params;

        const withdrawalRequest = await WithdrawalRequest.findById(requestId)
            .populate('userId', 'name phone balance totalGames totalWins')
            .populate('transactionId')
            .populate('processedBy', 'username');

        if (!withdrawalRequest) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                withdrawalRequest
            }
        });

    } catch (error) {
        console.error('Get withdrawal request details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get withdrawal request details'
        });
    }
};

export const approveWithdrawalRequest = async (req, res) => {
    try {
        const adminId = req.admin._id;
        const { requestId } = req.params;
        const { notes = '', paymentProof = '' } = req.body;

        const withdrawalRequest = await WithdrawalRequest.findById(requestId);
        if (!withdrawalRequest) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        if (withdrawalRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending withdrawal requests can be approved'
            });
        }

        // Approve withdrawal
        await withdrawalRequest.approve(adminId, notes);

        // Update payment proof if provided
        if (paymentProof) {
            withdrawalRequest.paymentProof = paymentProof;
            await withdrawalRequest.save();
        }

        res.status(200).json({
            success: true,
            message: 'Withdrawal request approved successfully',
            data: {
                withdrawalRequest: {
                    _id: withdrawalRequest._id,
                    status: withdrawalRequest.status,
                    processedAt: withdrawalRequest.processedAt,
                    adminNotes: withdrawalRequest.adminNotes
                }
            }
        });

    } catch (error) {
        console.error('Approve withdrawal request error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to approve withdrawal request'
        });
    }
};

export const rejectWithdrawalRequest = async (req, res) => {
    try {
        const adminId = req.admin._id;
        const { requestId } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const withdrawalRequest = await WithdrawalRequest.findById(requestId);
        if (!withdrawalRequest) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        if (withdrawalRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending withdrawal requests can be rejected'
            });
        }

        // Reject withdrawal (this will automatically refund the amount)
        await withdrawalRequest.reject(adminId, reason.trim());

        res.status(200).json({
            success: true,
            message: 'Withdrawal request rejected and amount refunded to user',
            data: {
                withdrawalRequest: {
                    _id: withdrawalRequest._id,
                    status: withdrawalRequest.status,
                    processedAt: withdrawalRequest.processedAt,
                    rejectionReason: withdrawalRequest.rejectionReason
                }
            }
        });

    } catch (error) {
        console.error('Reject withdrawal request error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to reject withdrawal request'
        });
    }
};

// User Management
export const getAllUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            status = 'all',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);

        // Build query
        const query = {};

        if (status !== 'all') {
            query.isActive = status === 'active';
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Get users
        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password')
                .sort(sort)
                .skip(skip)
                .limit(currentLimit)
                .lean(),
            User.countDocuments(query)
        ]);

        const result = buildPaginationResponse(users, total, currentPage, currentLimit);

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get users'
        });
    }
};

export const getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's recent transactions
        const recentTransactions = await Transaction.find({ userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Get user's recent rooms
        const recentRooms = await GameRoom.find({ 'players.userId': userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        res.status(200).json({
            success: true,
            data: {
                user,
                recentTransactions,
                recentRooms
            }
        });

    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user details'
        });
    }
};

export const blockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason = '' } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            {
                isActive: false,
                $push: {
                    adminActions: {
                        action: 'blocked',
                        reason,
                        adminId: req.admin._id,
                        timestamp: new Date()
                    }
                }
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Clear user cache
        cacheUtils.clearUserCache(userId);

        res.status(200).json({
            success: true,
            message: 'User blocked successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to block user'
        });
    }
};

export const unblockUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByIdAndUpdate(
            userId,
            {
                isActive: true,
                $push: {
                    adminActions: {
                        action: 'unblocked',
                        adminId: req.admin._id,
                        timestamp: new Date()
                    }
                }
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Clear user cache
        cacheUtils.clearUserCache(userId);

        res.status(200).json({
            success: true,
            message: 'User unblocked successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unblock user'
        });
    }
};

export const updateUserBalance = async (req, res) => {
    try {
        const { userId } = req.params;
        const { amount, type, reason } = req.body;

        if (!['add', 'deduct'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type must be either "add" or "deduct"'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Create transaction based on type
        const transactionType = type === 'add' ? 'deposit' : 'withdrawal';
        const transactionAmount = Math.abs(amount);
        const description = `Admin ${type === 'add' ? 'added' : 'deducted'} balance - ${reason}`;

        const transaction = await Transaction.createWithBalanceUpdate(
            userId,
            transactionType,
            transactionAmount,
            description,
            {
                metadata: {
                    adminAction: true,
                    adminId: req.admin._id,
                    reason
                }
            }
        );

        // Clear user cache
        cacheUtils.clearUserCache(userId);
        cache.del(cacheUtils.balanceKey(userId));

        res.status(200).json({
            success: true,
            message: `User balance ${type === 'add' ? 'increased' : 'decreased'} successfully`,
            data: {
                transaction: {
                    _id: transaction._id,
                    amount: transaction.amount,
                    newBalance: transaction.balanceAfter,
                    type: transaction.type
                }
            }
        });

    } catch (error) {
        console.error('Update user balance error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update user balance'
        });
    }
};

// Room Management
export const getAllRooms = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status = 'all',
            gameType = 'all',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);

        // Build query
        const query = {};
        if (status !== 'all') {
            query.status = status;
        }
        if (gameType !== 'all') {
            query.gameType = gameType;
        }

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Get rooms
        const [rooms, total] = await Promise.all([
            GameRoom.find(query)
                .populate('players.userId', 'name')
                .populate('createdBy', 'name')
                .populate('winner', 'name')
                .sort(sort)
                .skip(skip)
                .limit(currentLimit)
                .lean(),
            GameRoom.countDocuments(query)
        ]);

        const result = buildPaginationResponse(rooms, total, currentPage, currentLimit);

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Get all rooms error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get rooms'
        });
    }
};

export const getRoomDetails = async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await GameRoom.findOne({ roomId })
            .populate('players.userId', 'name phone')
            .populate('createdBy', 'name phone')
            .populate('winner', 'name phone');

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Get related transactions
        const transactions = await Transaction.find({ gameRoomId: room._id })
            .populate('userId', 'name phone')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                room,
                transactions
            }
        });

    } catch (error) {
        console.error('Get room details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get room details'
        });
    }
};

export const declareCorrectWinner = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { winnerId, reason } = req.body;

        const room = await GameRoom.findOne({ roomId });
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        if (!room.hasPlayer(winnerId)) {
            return res.status(400).json({
                success: false,
                message: 'Winner must be a player in the room'
            });
        }

        // Complete the game with correct winner
        room.completeGame(winnerId);
        await room.save();

        // Create winning transaction
        const totalAmount = room.amount * room.players.length;
        const platformFeePercent = parseInt(process.env.PLATFORM_FEE_PERCENTAGE) || 10;
        const platformFee = Math.floor(totalAmount * platformFeePercent / 100);
        const winnerAmount = totalAmount - platformFee;

        await Transaction.createWithBalanceUpdate(
            winnerId,
            'game_win',
            winnerAmount,
            `Game Won - Room ${room.roomId} (Admin declared)`,
            {
                gameRoomId: room._id,
                metadata: {
                    adminDeclared: true,
                    adminId: req.admin._id,
                    reason
                }
            }
        );

        // Update winner's game stats
        const winner = await User.findById(winnerId);
        if (winner) {
            await winner.incrementGameStats(true, winnerAmount);
        }

        // Clear caches
        cacheUtils.clearRoomsCache();

        res.status(200).json({
            success: true,
            message: 'Winner declared successfully',
            data: {
                room: {
                    _id: room._id,
                    roomId: room.roomId,
                    status: room.status,
                    winner: room.winner,
                    winnerAmount
                }
            }
        });

    } catch (error) {
        console.error('Declare correct winner error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to declare winner'
        });
    }
};

export const cancelRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { reason } = req.body;

        const room = await GameRoom.findOne({ roomId });
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        if (room.status === 'completed' || room.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Room is already completed or cancelled'
            });
        }

        // Cancel room
        room.status = 'cancelled';
        await room.save();

        // Refund all players
        for (const player of room.players) {
            await Transaction.createWithBalanceUpdate(
                player.userId,
                'refund',
                room.amount,
                `Room cancelled - ${room.roomId} (${reason})`,
                {
                    gameRoomId: room._id,
                    metadata: {
                        adminCancelled: true,
                        adminId: req.admin._id,
                        reason
                    }
                }
            );
        }

        // Clear caches
        cacheUtils.clearRoomsCache();

        res.status(200).json({
            success: true,
            message: 'Room cancelled and all players refunded',
            data: {
                room: {
                    _id: room._id,
                    roomId: room.roomId,
                    status: room.status
                }
            }
        });

    } catch (error) {
        console.error('Cancel room error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to cancel room'
        });
    }
};

// Transaction Management
export const getAllTransactions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type = 'all',
            status = 'all',
            userId,
            startDate,
            endDate,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);

        // Build query
        const query = {};
        if (type !== 'all') {
            query.type = type;
        }
        if (status !== 'all') {
            query.status = status;
        }
        if (userId) {
            query.userId = userId;
        }
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Get transactions
        const [transactions, total] = await Promise.all([
            Transaction.find(query)
                .populate('userId', 'name phone')
                .populate('gameRoomId', 'roomId')
                .sort(sort)
                .skip(skip)
                .limit(currentLimit)
                .lean(),
            Transaction.countDocuments(query)
        ]);

        const result = buildPaginationResponse(transactions, total, currentPage, currentLimit);

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Get all transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get transactions'
        });
    }
};

export const getTransactionDetails = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await Transaction.findById(transactionId)
            .populate('userId', 'name phone balance')
            .populate('gameRoomId');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                transaction
            }
        });

    } catch (error) {
        console.error('Get transaction details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get transaction details'
        });
    }
};

export const processRefund = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { reason } = req.body;

        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        if (transaction.type === 'refund') {
            return res.status(400).json({
                success: false,
                message: 'Cannot refund a refund transaction'
            });
        }

        // Create refund transaction
        const refundTransaction = await Transaction.createWithBalanceUpdate(
            transaction.userId,
            'refund',
            transaction.amount,
            `Refund for transaction ${transaction.transactionId} - ${reason}`,
            {
                metadata: {
                    originalTransactionId: transaction._id,
                    adminRefund: true,
                    adminId: req.admin._id,
                    reason
                }
            }
        );

        res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            data: {
                refundTransaction: {
                    _id: refundTransaction._id,
                    amount: refundTransaction.amount,
                    transactionId: refundTransaction.transactionId
                }
            }
        });

    } catch (error) {
        console.error('Process refund error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to process refund'
        });
    }
};

// System Stats
export const getSystemStats = async (req, res) => {
    try {
        const cacheKey = 'admin_system_stats';
        let cachedStats = cache.get(cacheKey);

        if (!cachedStats) {
            const [
                totalUsers,
                totalRooms,
                totalTransactions,
                totalRevenue
            ] = await Promise.all([
                User.countDocuments(),
                GameRoom.countDocuments(),
                Transaction.countDocuments(),
                Transaction.aggregate([
                    {
                        $match: {
                            type: 'game_loss',
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$amount' }
                        }
                    }
                ])
            ]);

            const platformRevenue = totalRevenue[0] ? Math.floor(totalRevenue[0].total * 0.1) : 0;

            cachedStats = {
                totalUsers,
                totalRooms,
                totalTransactions,
                platformRevenue,
                cacheStats: cache.getStats()
            };

            // Cache for 10 minutes
            cache.set(cacheKey, cachedStats, 600);
        }

        res.status(200).json({
            success: true,
            data: cachedStats
        });

    } catch (error) {
        console.error('Get system stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get system statistics'
        });
    }
};

export const getRevenueStats = async (req, res) => {
    try {
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

        const revenueStats = await Transaction.aggregate([
            {
                $match: {
                    type: 'game_loss',
                    status: 'completed',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    totalGames: { $sum: '$amount' },
                    gameCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    date: '$_id',
                    totalGames: 1,
                    gameCount: 1,
                    platformRevenue: { $multiply: ['$totalGames', 0.1] }
                }
            },
            {
                $sort: { date: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                period,
                startDate,
                endDate: new Date(),
                revenueData: revenueStats
            }
        });

    } catch (error) {
        console.error('Get revenue stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get revenue statistics'
        });
    }
};

export const getUserActivity = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);

        // Get user's activity (transactions and rooms)
        const [transactions, rooms, total] = await Promise.all([
            Transaction.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(currentLimit)
                .lean(),
            GameRoom.find({ 'players.userId': userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            Transaction.countDocuments({ userId })
        ]);

        const result = buildPaginationResponse(transactions, total, currentPage, currentLimit);

        res.status(200).json({
            success: true,
            data: {
                ...result,
                recentRooms: rooms
            }
        });

    } catch (error) {
        console.error('Get user activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user activity'
        });
    }
};

export const exportData = async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate } = req.query;

        // Build date filter
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) {
                dateFilter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                dateFilter.createdAt.$lte = new Date(endDate);
            }
        }

        let data = [];

        switch (type) {
            case 'users':
                data = await User.find(dateFilter).select('-password').lean();
                break;
            case 'transactions':
                data = await Transaction.find(dateFilter)
                    .populate('userId', 'name phone')
                    .lean();
                break;
            case 'rooms':
                data = await GameRoom.find(dateFilter)
                    .populate('players.userId', 'name')
                    .populate('createdBy', 'name')
                    .lean();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid export type'
                });
        }

        res.status(200).json({
            success: true,
            data: {
                type,
                count: data.length,
                exportData: data
            }
        });

    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export data'
        });
    }
};

// Winner Request Management
export const getWinnerRequests = async (req, res) => {
    try {
        const {
            status = 'all',
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);

        // Build query
        const query = {};
        if (status !== 'all') {
            query.status = status;
        }

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Get winner requests
        const [winnerRequests, total] = await Promise.all([
            WinnerRequest.find(query)
                .populate('gameRoomId')
                .populate('declaredBy', 'name phone')
                .populate('declaredWinner', 'name phone')
                .populate('processedBy', 'username')
                .sort(sort)
                .skip(skip)
                .limit(currentLimit)
                .lean(),
            WinnerRequest.countDocuments(query)
        ]);

        const result = buildPaginationResponse(winnerRequests, total, currentPage, currentLimit);

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Get winner requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get winner requests'
        });
    }
};

export const getWinnerRequestDetails = async (req, res) => {
    try {
        const { requestId } = req.params;

        const winnerRequest = await WinnerRequest.findById(requestId)
            .populate({
                path: 'gameRoomId',
                populate: [
                    { path: 'players.userId', select: 'name phone' },
                    { path: 'createdBy', select: 'name phone' }
                ]
            })
            .populate('declaredBy', 'name phone balance')
            .populate('declaredWinner', 'name phone balance')
            .populate('processedBy', 'username');

        if (!winnerRequest) {
            return res.status(404).json({
                success: false,
                message: 'Winner request not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                winnerRequest
            }
        });

    } catch (error) {
        console.error('Get winner request details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get winner request details'
        });
    }
};

export const approveWinnerRequest = async (req, res) => {
    try {
        const adminId = req.admin._id;
        const { requestId } = req.params;
        const { notes = '' } = req.body;

        const winnerRequest = await WinnerRequest.findById(requestId)
            .populate('gameRoomId');

        if (!winnerRequest) {
            return res.status(404).json({
                success: false,
                message: 'Winner request not found'
            });
        }

        if (winnerRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending winner requests can be approved'
            });
        }

        // Approve winner request
        winnerRequest.status = 'approved';
        winnerRequest.processedAt = new Date();
        winnerRequest.processedBy = adminId;
        winnerRequest.adminNotes = notes;
        await winnerRequest.save();

        // Update room status to completed
        const room = winnerRequest.gameRoomId;
        room.status = 'completed';
        room.completedAt = new Date();
        await room.save();

        // Create winning transaction
        await Transaction.createWithBalanceUpdate(
            winnerRequest.declaredWinner,
            'game_win',
            winnerRequest.winnerAmount,
            `Game Won - Room ${room.roomId} (Admin approved)`,
            {
                gameRoomId: room._id,
                metadata: {
                    adminApproved: true,
                    adminId,
                    winnerRequestId: winnerRequest._id,
                    notes
                }
            }
        );

        // Update winner's game stats
        const winner = await User.findById(winnerRequest.declaredWinner);
        if (winner) {
            await winner.incrementGameStats(true, winnerRequest.winnerAmount);
        }

        // Clear caches
        cacheUtils.clearRoomsCache();

        res.status(200).json({
            success: true,
            message: 'Winner request approved and winnings credited',
            data: {
                winnerRequest: {
                    _id: winnerRequest._id,
                    status: winnerRequest.status,
                    processedAt: winnerRequest.processedAt,
                    adminNotes: winnerRequest.adminNotes
                }
            }
        });

    } catch (error) {
        console.error('Approve winner request error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to approve winner request'
        });
    }
};

export const rejectWinnerRequest = async (req, res) => {
    try {
        const adminId = req.admin._id;
        const { requestId } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const winnerRequest = await WinnerRequest.findById(requestId)
            .populate('gameRoomId');

        if (!winnerRequest) {
            return res.status(404).json({
                success: false,
                message: 'Winner request not found'
            });
        }

        if (winnerRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending winner requests can be rejected'
            });
        }

        // Reject winner request
        winnerRequest.status = 'rejected';
        winnerRequest.processedAt = new Date();
        winnerRequest.processedBy = adminId;
        winnerRequest.adminNotes = reason.trim();
        await winnerRequest.save();

        // Reset room status to playing so another winner can be declared
        const room = winnerRequest.gameRoomId;
        room.status = 'playing';
        room.winner = null;
        await room.save();

        // Clear caches
        cacheUtils.clearRoomsCache();

        res.status(200).json({
            success: true,
            message: 'Winner request rejected. Room is back to playing status.',
            data: {
                winnerRequest: {
                    _id: winnerRequest._id,
                    status: winnerRequest.status,
                    processedAt: winnerRequest.processedAt,
                    adminNotes: winnerRequest.adminNotes
                }
            }
        });

    } catch (error) {
        console.error('Reject winner request error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to reject winner request'
        });
    }
};
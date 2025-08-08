import Admin from '../models/Admin.js';
import User from '../models/User.js';
import GameRoom from '../models/GameRoom.js';
import Transaction from '../models/Transaction.js';
import jwt from 'jsonwebtoken';
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
                message: 'Invalid username or password'
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
                message: 'Invalid username or password'
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
        const token = jwt.sign(
            { adminId: admin._id, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' } // Admin sessions expire in 8 hours
        );

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                admin: {
                    _id: admin._id,
                    username: admin.username,
                    role: admin.role,
                    permissions: admin.permissions,
                    lastLogin: admin.lastLogin
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
        // In a more sophisticated setup, you might want to blacklist the token
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
            const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            // Parallel queries for better performance
            const [
                totalUsers,
                activeUsers,
                blockedUsers,
                totalRooms,
                activeRooms,
                completedRooms,
                totalTransactions,
                totalRevenue,
                todayStats,
                weekStats,
                monthStats,
                recentUsers,
                recentTransactions,
                topWinners
            ] = await Promise.all([
                // User stats
                User.countDocuments({ isActive: true }),
                User.countDocuments({ isActive: true, lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
                User.countDocuments({ isActive: false }),

                // Room stats
                GameRoom.countDocuments(),
                GameRoom.countDocuments({ status: { $in: ['waiting', 'playing'] } }),
                GameRoom.countDocuments({ status: 'completed' }),

                // Transaction stats
                Transaction.countDocuments({ status: 'completed' }),
                Transaction.aggregate([
                    { $match: { type: 'game_loss', status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),

                // Today's stats
                Transaction.aggregate([
                    { $match: { createdAt: { $gte: startOfToday }, status: 'completed' } },
                    { $group: { _id: '$type', count: { $sum: 1 }, amount: { $sum: '$amount' } } }
                ]),

                // This week's stats
                Transaction.aggregate([
                    { $match: { createdAt: { $gte: startOfWeek }, status: 'completed' } },
                    { $group: { _id: '$type', count: { $sum: 1 }, amount: { $sum: '$amount' } } }
                ]),

                // This month's stats
                Transaction.aggregate([
                    { $match: { createdAt: { $gte: startOfMonth }, status: 'completed' } },
                    { $group: { _id: '$type', count: { $sum: 1 }, amount: { $sum: '$amount' } } }
                ]),

                // Recent users
                User.find({ isActive: true })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .select('name phone balance createdAt')
                    .lean(),

                // Recent transactions
                Transaction.find({ status: 'completed' })
                    .populate('userId', 'name phone')
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean(),

                // Top winners
                User.find({ isActive: true })
                    .sort({ totalWinnings: -1 })
                    .limit(5)
                    .select('name phone totalWinnings totalWins totalGames')
                    .lean()
            ]);

            // Format stats
            const formatPeriodStats = (stats) => {
                const result = { deposits: 0, withdrawals: 0, gameRevenue: 0, transactions: 0 };
                stats.forEach(stat => {
                    result.transactions += stat.count;
                    switch (stat._id) {
                        case 'deposit':
                            result.deposits = stat.amount;
                            break;
                        case 'withdrawal':
                            result.withdrawals = stat.amount;
                            break;
                        case 'game_loss':
                            result.gameRevenue = stat.amount;
                            break;
                    }
                });
                return result;
            };

            cachedStats = {
                overview: {
                    totalUsers,
                    activeUsers,
                    blockedUsers,
                    totalRooms,
                    activeRooms,
                    completedRooms,
                    totalTransactions,
                    totalRevenue: totalRevenue[0]?.total || 0
                },
                periodStats: {
                    today: formatPeriodStats(todayStats),
                    thisWeek: formatPeriodStats(weekStats),
                    thisMonth: formatPeriodStats(monthStats)
                },
                recentActivity: {
                    users: recentUsers,
                    transactions: recentTransactions.map(t => ({
                        _id: t._id,
                        type: t.type,
                        amount: t.amount,
                        user: t.userId,
                        createdAt: t.createdAt
                    }))
                },
                topWinners: topWinners.map(user => ({
                    ...user,
                    winRate: user.totalGames > 0 ? Math.round((user.totalWins / user.totalGames) * 100) : 0
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
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get dashboard statistics'
        });
    }
};

export const getSystemStats = async (req, res) => {
    try {
        const cacheKey = 'admin_system_stats';
        let cachedStats = cache.get(cacheKey);

        if (!cachedStats) {
            // Get system performance stats
            const [
                dbStats,
                cacheStats,
                errorLogs
            ] = await Promise.all([
                // Database stats
                mongoose.connection.db.stats(),

                // Cache stats
                cache.getStats(),

                // Recent error logs (you might want to implement error logging)
                Promise.resolve([])
            ]);

            cachedStats = {
                database: {
                    collections: dbStats.collections,
                    dataSize: Math.round(dbStats.dataSize / 1024 / 1024), // MB
                    indexSize: Math.round(dbStats.indexSize / 1024 / 1024), // MB
                    totalSize: Math.round(dbStats.storageSize / 1024 / 1024) // MB
                },
                cache: {
                    keys: cacheStats.keys,
                    hits: cacheStats.hits,
                    misses: cacheStats.misses,
                    hitRate: cacheStats.hits > 0 ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100) : 0
                },
                server: {
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                    nodeVersion: process.version,
                    environment: process.env.NODE_ENV
                }
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

        const cacheKey = `admin_revenue_stats_${period}`;
        let cachedStats = cache.get(cacheKey);

        if (!cachedStats) {
            // Revenue analytics
            const revenueData = await Transaction.aggregate([
                {
                    $match: {
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
            ]);

            // Platform fee calculation (from game losses)
            const platformRevenue = await GameRoom.aggregate([
                {
                    $match: {
                        status: 'completed',
                        completedAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalPlatformFee: { $sum: '$platformFee' },
                        totalGames: { $sum: 1 },
                        totalPrizePool: { $sum: '$totalPrizePool' }
                    }
                }
            ]);

            cachedStats = {
                period,
                startDate,
                endDate: new Date(),
                revenue: {
                    platformFee: platformRevenue[0]?.totalPlatformFee || 0,
                    totalGames: platformRevenue[0]?.totalGames || 0,
                    totalPrizePool: platformRevenue[0]?.totalPrizePool || 0
                },
                transactions: {},
                chartData: {}
            };

            revenueData.forEach(item => {
                cachedStats.transactions[item._id] = {
                    totalAmount: item.totalAmount,
                    totalCount: item.totalCount,
                    averageAmount: Math.round(item.totalAmount / item.totalCount)
                };
                cachedStats.chartData[item._id] = item.dailyData;
            });

            // Cache for 15 minutes
            cache.set(cacheKey, cachedStats, 900);
        }

        res.status(200).json({
            success: true,
            data: cachedStats
        });

    } catch (error) {
        console.error('Get revenue stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get revenue statistics'
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

        // Add additional stats for each user
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                const [recentTransactions, activeRooms] = await Promise.all([
                    Transaction.countDocuments({
                        userId: user._id,
                        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                    }),
                    GameRoom.countDocuments({
                        'players.userId': user._id,
                        status: { $in: ['waiting', 'playing'] }
                    })
                ]);

                return {
                    ...user,
                    recentTransactions,
                    activeRooms,
                    winRate: user.totalGames > 0 ? Math.round((user.totalWins / user.totalGames) * 100) : 0
                };
            })
        );

        const result = buildPaginationResponse(usersWithStats, total, currentPage, currentLimit);

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

        // Get user details
        const user = await User.findById(userId).select('-password').lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's recent activity
        const [recentTransactions, recentRooms, monthlyStats] = await Promise.all([
            Transaction.find({ userId })
                .populate('gameRoomId', 'roomId')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),

            GameRoom.find({ 'players.userId': userId })
                .populate('winner', 'name')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),

            Transaction.aggregate([
                {
                    $match: {
                        userId: new mongoose.Types.ObjectId(userId),
                        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
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
            ])
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

        res.status(200).json({
            success: true,
            data: {
                user: {
                    ...user,
                    winRate: user.totalGames > 0 ? Math.round((user.totalWins / user.totalGames) * 100) : 0
                },
                monthlyStats: monthlyData,
                recentTransactions: recentTransactions.map(t => ({
                    _id: t._id,
                    type: t.type,
                    amount: t.amount,
                    description: t.description,
                    status: t.status,
                    roomId: t.gameRoomId?.roomId,
                    createdAt: t.createdAt
                })),
                recentRooms: recentRooms.map(room => ({
                    _id: room._id,
                    roomId: room.roomId,
                    gameType: room.gameType,
                    amount: room.amount,
                    status: room.status,
                    isWinner: room.winner?._id.toString() === userId,
                    createdAt: room.createdAt
                }))
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
        const { reason = 'Blocked by admin' } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.isActive) {
            return res.status(400).json({
                success: false,
                message: 'User is already blocked'
            });
        }

        // Block user
        user.isActive = false;
        await user.save();

        // Cancel any active rooms created by this user
        await GameRoom.updateMany(
            { createdBy: userId, status: { $in: ['waiting', 'playing'] } },
            { status: 'cancelled' }
        );

        // Clear user cache
        cacheUtils.clearUserCache(userId);

        res.status(200).json({
            success: true,
            message: 'User blocked successfully',
            data: {
                userId,
                reason,
                blockedAt: new Date()
            }
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

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isActive) {
            return res.status(400).json({
                success: false,
                message: 'User is not blocked'
            });
        }

        // Unblock user
        user.isActive = true;
        await user.save();

        // Clear user cache
        cacheUtils.clearUserCache(userId);

        res.status(200).json({
            success: true,
            message: 'User unblocked successfully',
            data: {
                userId,
                unblockedAt: new Date()
            }
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

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Calculate new balance
        const adjustmentAmount = type === 'add' ? amount : -amount;
        const newBalance = user.balance + adjustmentAmount;

        if (newBalance < 0) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance for deduction'
            });
        }

        // Create transaction
        const transactionType = type === 'add' ? 'deposit' : 'withdrawal';
        const description = `Admin ${type === 'add' ? 'added' : 'deducted'} balance - ${reason}`;

        const transaction = await Transaction.createWithBalanceUpdate(
            userId,
            transactionType,
            amount,
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
            message: `Balance ${type === 'add' ? 'added' : 'deducted'} successfully`,
            data: {
                transaction: {
                    _id: transaction._id,
                    amount: transaction.amount,
                    type: transaction.type,
                    newBalance: transaction.balanceAfter,
                    reason
                }
            }
        });

    } catch (error) {
        console.error('Update user balance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user balance'
        });
    }
};

export const getUserActivity = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const { page: currentPage, limit: currentLimit, skip } = getPagination(page, limit);

        // Get user activity (transactions and room activities)
        const [transactions, rooms, totalTransactions, totalRooms] = await Promise.all([
            Transaction.find({ userId })
                .populate('gameRoomId', 'roomId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Math.floor(currentLimit / 2))
                .lean(),

            GameRoom.find({ 'players.userId': userId })
                .populate('winner', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Math.floor(currentLimit / 2))
                .lean(),

            Transaction.countDocuments({ userId }),
            GameRoom.countDocuments({ 'players.userId': userId })
        ]);

        // Combine and sort activities
        const activities = [
            ...transactions.map(t => ({
                type: 'transaction',
                _id: t._id,
                transactionType: t.type,
                amount: t.amount,
                description: t.description,
                status: t.status,
                roomId: t.gameRoomId?.roomId,
                createdAt: t.createdAt
            })),
            ...rooms.map(r => ({
                type: 'room',
                _id: r._id,
                roomId: r.roomId,
                gameType: r.gameType,
                amount: r.amount,
                status: r.status,
                isWinner: r.winner?._id.toString() === userId,
                createdAt: r.createdAt
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const result = buildPaginationResponse(
            activities.slice(0, currentLimit),
            totalTransactions + totalRooms,
            currentPage,
            currentLimit
        );

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Get user activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user activity'
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
                .populate('players.userId', 'name phone')
                .populate('createdBy', 'name phone')
                .populate('winner', 'name phone')
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

        // Find room by roomId (not _id)
        const room = await GameRoom.findOne({ roomId })
            .populate('players.userId', 'name phone balance')
            .populate('createdBy', 'name phone')
            .populate('winner', 'name phone')
            .lean();

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Get related transactions
        const transactions = await Transaction.find({ gameRoomId: room._id })
            .populate('userId', 'name phone')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: {
                room,
                transactions: transactions.map(t => ({
                    _id: t._id,
                    type: t.type,
                    amount: t.amount,
                    description: t.description,
                    status: t.status,
                    user: t.userId,
                    createdAt: t.createdAt
                }))
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

        // Find room
        const room = await GameRoom.findOne({ roomId })
            .populate('players.userId', 'name')
            .populate('winner', 'name');

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        if (room.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Can only correct winner for completed games'
            });
        }

        // Check if new winner is in the room
        if (!room.hasPlayer(winnerId)) {
            return res.status(400).json({
                success: false,
                message: 'New winner must be a player in the room'
            });
        }

        const oldWinnerId = room.winner ? room.winner._id : null;

        if (!oldWinnerId) {
            return res.status(400).json({
                success: false,
                message: 'No previous winner found for this room'
            });
        }

        if (oldWinnerId.toString() === winnerId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'This user is already the winner'
            });
        }

        // Retry logic for handling write conflicts
        const maxRetries = 3;
        let retryCount = 0;
        let finalOldBalance = 0;
        let finalNewBalance = 0;

        while (retryCount < maxRetries) {
            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {
                    // Get fresh data within transaction to avoid conflicts
                    const [currentRoom, oldWinner, newWinner] = await Promise.all([
                        GameRoom.findOne({ roomId }).session(session),
                        User.findById(oldWinnerId).session(session),
                        User.findById(winnerId).session(session)
                    ]);

                    if (!currentRoom || !oldWinner || !newWinner) {
                        throw new Error('Required data not found');
                    }

                    // Check old winner's current balance
                    if (oldWinner.balance < room.winnerAmount) {
                        throw new Error('Old winner has insufficient balance for correction');
                    }

                    // Step 1: Deduct amount from old winner
                    oldWinner.balance -= room.winnerAmount;
                    oldWinner.totalWins = Math.max(0, oldWinner.totalWins - 1);
                    oldWinner.totalWinnings = Math.max(0, oldWinner.totalWinnings - room.winnerAmount);

                    // Step 2: Add amount to new winner
                    newWinner.balance += room.winnerAmount;
                    newWinner.totalWins += 1;
                    newWinner.totalWinnings += room.winnerAmount;

                    // Step 3: Update room winner
                    currentRoom.winner = winnerId;

                    // Step 4: Save all changes
                    await Promise.all([
                        oldWinner.save({ session }),
                        newWinner.save({ session }),
                        currentRoom.save({ session })
                    ]);

                    // Step 5: Create transaction records
                    const timestamp = new Date();
                    const transactionData = [
                        {
                            userId: oldWinnerId,
                            type: 'withdrawal',
                            amount: room.winnerAmount,
                            description: `Admin Correction - Reversed incorrect win for Room ${room.roomId}`,
                            status: 'completed',
                            gameRoomId: room._id,
                            balanceBefore: oldWinner.balance + room.winnerAmount,
                            balanceAfter: oldWinner.balance,
                            transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
                            metadata: {
                                adminCorrection: true,
                                adminId: req.admin._id,
                                reason,
                                correctionType: 'winner_reversal'
                            },
                            createdAt: timestamp,
                            updatedAt: timestamp
                        },
                        {
                            userId: winnerId,
                            type: 'game_win',
                            amount: room.winnerAmount,
                            description: `Admin Correction - Correct winner declared for Room ${room.roomId}`,
                            status: 'completed',
                            gameRoomId: room._id,
                            balanceBefore: newWinner.balance - room.winnerAmount,
                            balanceAfter: newWinner.balance,
                            transactionId: `TXN${Date.now() + 1}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
                            metadata: {
                                adminCorrection: true,
                                adminId: req.admin._id,
                                reason,
                                previousWinner: oldWinnerId,
                                correctionType: 'winner_declaration'
                            },
                            createdAt: timestamp,
                            updatedAt: timestamp
                        }
                    ];

                    await Transaction.insertMany(transactionData, { session });

                    // Store final balances for response
                    finalOldBalance = oldWinner.balance;
                    finalNewBalance = newWinner.balance;
                }, {
                    readPreference: 'primary',
                    readConcern: { level: 'majority' },
                    writeConcern: { w: 'majority' }
                });

                // Transaction completed successfully
                await session.endSession();

                // Clear caches after successful transaction
                cacheUtils.clearRoomsCache();
                cacheUtils.clearUserCache(oldWinnerId);
                cacheUtils.clearUserCache(winnerId);
                cache.del(cacheUtils.balanceKey(oldWinnerId));
                cache.del(cacheUtils.balanceKey(winnerId));

                // Get updated user details for response
                const [oldWinnerDetails, newWinnerDetails] = await Promise.all([
                    User.findById(oldWinnerId).select('name balance'),
                    User.findById(winnerId).select('name balance')
                ]);

                return res.status(200).json({
                    success: true,
                    message: 'Winner corrected successfully',
                    data: {
                        roomId: room.roomId,
                        previousWinner: {
                            _id: oldWinnerId,
                            name: oldWinnerDetails?.name,
                            newBalance: oldWinnerDetails?.balance
                        },
                        newWinner: {
                            _id: winnerId,
                            name: newWinnerDetails?.name,
                            newBalance: newWinnerDetails?.balance
                        },
                        amount: room.winnerAmount,
                        reason,
                        correctedAt: new Date(),
                        correctedBy: req.admin.username
                    }
                });

            } catch (error) {
                await session.endSession();

                // Check if it's a write conflict error
                if (error.code === 112 || error.message.includes('Write conflict') || error.message.includes('WriteConflict')) {
                    retryCount++;
                    console.log(`Write conflict detected, retry ${retryCount}/${maxRetries}`);

                    if (retryCount < maxRetries) {
                        // Wait before retrying with exponential backoff
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
                        continue;
                    }
                }

                console.error('Winner correction error:', error);
                throw error;
            }
        }

        // If we reach here, all retries failed
        return res.status(500).json({
            success: false,
            message: 'Failed to correct winner after multiple attempts. Please try again.'
        });
    } catch (error) {
        console.error('Declare correct winner error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to correct winner'
        });
    }
};

export const cancelRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { reason } = req.body;

        // Find room
        const room = await GameRoom.findOne({ roomId })
            .populate('players.userId', 'name');

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        if (room.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Room is already cancelled'
            });
        }

        if (room.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel completed room'
            });
        }

        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            // Refund all players
            for (const player of room.players) {
                await Transaction.createWithBalanceUpdate(
                    player.userId._id,
                    'refund',
                    room.amount,
                    `Room cancelled by admin - ${reason}`,
                    {
                        gameRoomId: room._id,
                        metadata: {
                            adminAction: true,
                            adminId: req.admin._id,
                            reason
                        }
                    }
                );
            }

            // Cancel room
            room.status = 'cancelled';
            await room.save({ session });

            await session.commitTransaction();

            // Clear caches
            cacheUtils.clearRoomsCache();
            for (const player of room.players) {
                cacheUtils.clearUserCache(player.userId._id);
                cache.del(cacheUtils.balanceKey(player.userId._id));
            }

            res.status(200).json({
                success: true,
                message: 'Room cancelled and players refunded successfully',
                data: {
                    roomId: room.roomId,
                    refundedPlayers: room.players.length,
                    refundAmount: room.amount,
                    reason,
                    cancelledAt: new Date()
                }
            });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('Cancel room error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel room'
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
                .populate('gameRoomId', 'roomId gameType')
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
            .populate('gameRoomId', 'roomId gameType players winner')
            .lean();

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

        const originalTransaction = await Transaction.findById(transactionId)
            .populate('userId', 'name');

        if (!originalTransaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        if (originalTransaction.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Can only refund completed transactions'
            });
        }

        // Check if already refunded
        const existingRefund = await Transaction.findOne({
            'metadata.originalTransactionId': transactionId,
            type: 'refund'
        });

        if (existingRefund) {
            return res.status(400).json({
                success: false,
                message: 'Transaction has already been refunded'
            });
        }

        // Only allow refund for certain transaction types
        if (!['withdrawal', 'game_loss'].includes(originalTransaction.type)) {
            return res.status(400).json({
                success: false,
                message: 'This transaction type cannot be refunded'
            });
        }

        // Create refund transaction
        const refundTransaction = await Transaction.createWithBalanceUpdate(
            originalTransaction.userId._id,
            'refund',
            originalTransaction.amount,
            `Admin refund - ${reason}`,
            {
                metadata: {
                    adminRefund: true,
                    adminId: req.admin._id,
                    originalTransactionId: transactionId,
                    reason
                }
            }
        );

        // Clear user cache
        cacheUtils.clearUserCache(originalTransaction.userId._id);
        cache.del(cacheUtils.balanceKey(originalTransaction.userId._id));

        res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            data: {
                refundTransaction: {
                    _id: refundTransaction._id,
                    amount: refundTransaction.amount,
                    newBalance: refundTransaction.balanceAfter,
                    reason
                }
            }
        });

    } catch (error) {
        console.error('Process refund error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process refund'
        });
    }
};

// Data Export
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
        let filename = '';

        switch (type) {
            case 'users':
                data = await User.find(dateFilter)
                    .select('-password')
                    .lean();
                filename = `users_export_${Date.now()}.json`;
                break;

            case 'transactions':
                data = await Transaction.find(dateFilter)
                    .populate('userId', 'name phone')
                    .populate('gameRoomId', 'roomId')
                    .lean();
                filename = `transactions_export_${Date.now()}.json`;
                break;

            case 'rooms':
                data = await GameRoom.find(dateFilter)
                    .populate('players.userId', 'name phone')
                    .populate('createdBy', 'name phone')
                    .populate('winner', 'name phone')
                    .lean();
                filename = `rooms_export_${Date.now()}.json`;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid export type'
                });
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).json({
            success: true,
            exportType: type,
            exportDate: new Date(),
            totalRecords: data.length,
            data
        });

    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export data'
        });
    }
};
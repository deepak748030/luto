import NodeCache from 'node-cache';

// Create cache instance with default TTL of 5 minutes
export const cache = new NodeCache({
  stdTTL: parseInt(process.env.CACHE_TTL_SECONDS) || 300,
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Don't clone objects for better performance
});

// Cache utility functions
export const cacheUtils = {
  // Set cache with custom TTL
  set: (key, value, ttl = null) => {
    return cache.set(key, value, ttl);
  },
  
  // Get from cache
  get: (key) => {
    return cache.get(key);
  },
  
  // Delete from cache
  del: (key) => {
    return cache.del(key);
  },
  
  // Delete multiple keys
  delMany: (keys) => {
    return cache.del(keys);
  },
  
  // Check if key exists
  has: (key) => {
    return cache.has(key);
  },
  
  // Get cache statistics
  getStats: () => {
    return cache.getStats();
  },
  
  // Clear all cache
  flushAll: () => {
    return cache.flushAll();
  },
  
  // Generate cache key for user data
  userKey: (userId) => `user_${userId}`,
  
  // Generate cache key for user balance
  balanceKey: (userId) => `balance_${userId}`,
  
  // Generate cache key for user stats
  statsKey: (userId) => `stats_${userId}`,
  
  // Generate cache key for rooms list
  roomsKey: (status = 'all', page = 1) => `rooms_${status}_${page}`,
  
  // Generate cache key for user rooms
  userRoomsKey: (userId, status = 'all') => `user_rooms_${userId}_${status}`,
  
  // Generate cache key for transactions
  transactionsKey: (userId, type = 'all', page = 1) => `transactions_${userId}_${type}_${page}`,
  
  // Clear user-related cache
  clearUserCache: (userId) => {
    const keys = [
      cacheUtils.userKey(userId),
      cacheUtils.balanceKey(userId),
      cacheUtils.statsKey(userId)
    ];
    return cache.del(keys);
  },
  
  // Clear rooms cache
  clearRoomsCache: () => {
    const keys = cache.keys().filter(key => key.startsWith('rooms_'));
    if (keys.length > 0) {
      return cache.del(keys);
    }
    return 0;
  }
};
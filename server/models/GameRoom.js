import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const gameRoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: [true, 'Room ID is required'],
    uppercase: true,
    validate: {
      validator: function (v) {
        return /^[A-Z]{2}[0-9]{6}$/.test(v);
      },
      message: 'Room ID must be in format LK123456'
    }
  },
  gameType: {
    type: String,
    default: 'Ludo',
    enum: ['Ludo', 'Snakes & Ladders', 'Carrom']
  },
  amount: {
    type: Number,
    required: [true, 'Game amount is required'],
    min: [10, 'Minimum game amount is ₹10'],
    max: [10000, 'Maximum game amount is ₹10,000']
  },
  maxPlayers: {
    type: Number,
    required: true,
    min: [2, 'Minimum 2 players required'],
    max: [4, 'Maximum 4 players allowed'],
    default: 4
  },
  players: [playerSchema],
  status: {
    type: String,
    enum: ['waiting', 'playing', 'completed', 'cancelled'],
    default: 'waiting'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startedAt: Date,
  completedAt: Date,
  totalPrizePool: {
    type: Number,
    default: 0
  },
  platformFee: {
    type: Number,
    default: 0
  },
  winnerAmount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for performance
gameRoomSchema.index({ roomId: 1 }, { unique: true });
gameRoomSchema.index({ status: 1 });
gameRoomSchema.index({ createdAt: -1 });
gameRoomSchema.index({ 'players.userId': 1 });
gameRoomSchema.index({ createdBy: 1 });

// Virtual for current player count
gameRoomSchema.virtual('currentPlayers').get(function () {
  return this.players.length;
});

// Virtual for is room full
gameRoomSchema.virtual('isFull').get(function () {
  return this.players.length >= this.maxPlayers;
});

// Method to check if user is in room
gameRoomSchema.methods.hasPlayer = function (userId) {
  return this.players.some(player => player.userId.toString() === userId.toString());
};

// Method to add player to room
gameRoomSchema.methods.addPlayer = function (userId, userName) {
  if (this.hasPlayer(userId)) {
    throw new Error('User already in room');
  }

  if (this.isFull) {
    throw new Error('Room is full');
  }

  if (this.status !== 'waiting') {
    throw new Error('Cannot join room that is not waiting');
  }

  this.players.push({
    userId,
    name: userName,
    joinedAt: new Date()
  });

  return this;
};

// Method to start game
gameRoomSchema.methods.startGame = function () {
  if (this.status !== 'waiting') {
    throw new Error('Game can only be started from waiting status');
  }

  if (!this.isFull) {
    throw new Error('Room must be full to start game');
  }

  this.status = 'playing';
  this.startedAt = new Date();

  // Calculate prize pool and fees
  const totalAmount = this.amount * this.players.length;
  const platformFeePercent = parseInt(process.env.PLATFORM_FEE_PERCENTAGE) || 10;
  this.platformFee = Math.floor(totalAmount * platformFeePercent / 100);
  this.totalPrizePool = totalAmount;
  this.winnerAmount = totalAmount - this.platformFee;

  return this;
};

// Method to complete game
gameRoomSchema.methods.completeGame = function (winnerId) {
  if (this.status !== 'playing') {
    throw new Error('Game can only be completed from playing status');
  }

  if (!this.hasPlayer(winnerId)) {
    throw new Error('Winner must be a player in the room');
  }

  this.status = 'completed';
  this.winner = winnerId;
  this.completedAt = new Date();

  return this;
};

// Pre-save middleware to generate room ID if not provided
gameRoomSchema.pre('save', function (next) {
  if (!this.roomId && this.isNew) {
    // Generate room ID: LK + 6 random digits
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    this.roomId = `LK${randomNum}`;
  }
  next();
});

export default mongoose.model('GameRoom', gameRoomSchema);
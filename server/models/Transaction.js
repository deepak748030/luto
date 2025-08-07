import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'game_win', 'game_loss', 'refund'],
    required: [true, 'Transaction type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be positive']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  gameRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameRoom'
  },
  upiId: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (this.type === 'withdrawal' && !v) return false;
        if (v) return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(v);
        return true;
      },
      message: 'Please enter a valid UPI ID'
    }
  },
  transactionId: {
    type: String,
    sparse: true
  },
  paymentId: String,
  orderId: String,
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  processingFee: {
    type: Number,
    default: 0,
    min: 0
  },
  metadata: {
    roomCode: String,
    paymentMethod: String,
    failureReason: String,
    adminNotes: String
  }
}, {
  timestamps: true
});

// Indexes for performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ gameRoomId: 1 });

// Pre-save middleware to generate transaction ID
transactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.transactionId = `TXN${timestamp}${random}`;
  }
  next();
});

// Static method to create transaction with balance update
transactionSchema.statics.createWithBalanceUpdate = async function(userId, type, amount, description, additionalData = {}) {
  const User = mongoose.model('User');
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Get current user balance
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new Error('User not found');
    }
    
    const balanceBefore = user.balance;
    let balanceAfter = balanceBefore;
    
    // Calculate new balance based on transaction type
    if (type === 'deposit' || type === 'game_win' || type === 'refund') {
      balanceAfter = balanceBefore + amount;
    } else if (type === 'withdrawal' || type === 'game_loss') {
      balanceAfter = balanceBefore - amount;
      if (balanceAfter < 0) {
        throw new Error('Insufficient balance');
      }
    }
    
    // Update user balance
    await User.findByIdAndUpdate(
      userId, 
      { balance: balanceAfter },
      { session }
    );
    
    // Create transaction record
    const transaction = await this.create([{
      userId,
      type,
      amount,
      description,
      balanceBefore,
      balanceAfter,
      ...additionalData
    }], { session });
    
    await session.commitTransaction();
    return transaction[0];
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export default mongoose.model('Transaction', transactionSchema);
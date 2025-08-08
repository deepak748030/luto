import mongoose from 'mongoose';

const winnerRequestSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: [true, 'Room ID is required'],
        trim: true
    },
    gameRoomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GameRoom',
        required: true
    },
    declaredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    declaredWinner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminNotes: {
        type: String,
        trim: true
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    processedAt: Date,
    winnerAmount: {
        type: Number,
        required: true
    },
    totalPrizePool: {
        type: Number,
        required: true
    },
    platformFee: {
        type: Number,
        required: true
    },
    evidence: {
        screenshots: [String],
        description: String
    }
}, {
    timestamps: true
});

// Indexes
winnerRequestSchema.index({ roomId: 1 });
winnerRequestSchema.index({ status: 1 });
winnerRequestSchema.index({ createdAt: -1 });
winnerRequestSchema.index({ gameRoomId: 1 });

export default mongoose.model('WinnerRequest', winnerRequestSchema);
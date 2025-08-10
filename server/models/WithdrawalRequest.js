import mongoose from 'mongoose';

const withdrawalRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: [true, 'Transaction ID is required']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [1, 'Amount must be positive']
    },
    upiId: {
        type: String,
        required: [true, 'UPI ID is required'],
        trim: true,
        validate: {
            validator: function (v) {
                return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(v);
            },
            message: 'Please enter a valid UPI ID'
        }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending'
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    processedAt: Date,
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    adminNotes: {
        type: String,
        trim: true
    },
    rejectionReason: {
        type: String,
        trim: true
    },
    paymentProof: {
        type: String, // URL or reference to payment proof
        trim: true
    },
    userInfo: {
        name: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        }
    }
}, {
    timestamps: true
});

// Indexes for performance
withdrawalRequestSchema.index({ userId: 1, status: 1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });
withdrawalRequestSchema.index({ transactionId: 1 });

// Method to approve withdrawal
withdrawalRequestSchema.methods.approve = async function (adminId, notes = '') {
    if (this.status !== 'pending') {
        throw new Error('Only pending withdrawals can be approved');
    }

    this.status = 'approved';
    this.processedAt = new Date();
    this.processedBy = adminId;
    this.adminNotes = notes;

    // Update related transaction status
    const Transaction = mongoose.model('Transaction');
    await Transaction.findByIdAndUpdate(this.transactionId, {
        status: 'completed',
        'metadata.adminNotes': notes,
        'metadata.processedBy': adminId
    });

    return await this.save();
};

// Method to reject withdrawal
withdrawalRequestSchema.methods.reject = async function (adminId, reason) {
    if (this.status !== 'pending') {
        throw new Error('Only pending withdrawals can be rejected');
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        this.status = 'rejected';
        this.processedAt = new Date();
        this.processedBy = adminId;
        this.rejectionReason = reason;

        // Update related transaction status
        const Transaction = mongoose.model('Transaction');
        await Transaction.findByIdAndUpdate(this.transactionId, {
            status: 'failed',
            'metadata.rejectionReason': reason,
            'metadata.processedBy': adminId
        }, { session });

        // Create refund transaction
        await Transaction.createWithBalanceUpdate(
            this.userId,
            'refund',
            this.amount,
            `Withdrawal refund - ${reason}`,
            {
                metadata: {
                    originalTransactionId: this.transactionId,
                    withdrawalRequestId: this._id,
                    refundReason: reason
                }
            }
        );

        await this.save({ session });
        await session.commitTransaction();

        return this;

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// Method to cancel withdrawal (by user)
withdrawalRequestSchema.methods.cancel = async function () {
    if (this.status !== 'pending') {
        throw new Error('Only pending withdrawals can be cancelled');
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        this.status = 'cancelled';
        this.processedAt = new Date();

        // Update related transaction status
        const Transaction = mongoose.model('Transaction');
        await Transaction.findByIdAndUpdate(this.transactionId, {
            status: 'cancelled',
            'metadata.cancelledBy': 'user'
        }, { session });

        // Create refund transaction
        await Transaction.createWithBalanceUpdate(
            this.userId,
            'refund',
            this.amount,
            'Withdrawal cancelled by user',
            {
                metadata: {
                    originalTransactionId: this.transactionId,
                    withdrawalRequestId: this._id,
                    refundReason: 'User cancelled withdrawal'
                }
            }
        );

        await this.save({ session });
        await session.commitTransaction();

        return this;

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export default mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [20, 'Username must not exceed 20 characters']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'moderator'],
        default: 'admin'
    },
    permissions: {
        users: {
            view: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            block: { type: Boolean, default: true },
            delete: { type: Boolean, default: false }
        },
        rooms: {
            view: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            declare_winner: { type: Boolean, default: true },
            cancel: { type: Boolean, default: true }
        },
        transactions: {
            view: { type: Boolean, default: true },
            edit: { type: Boolean, default: false },
            refund: { type: Boolean, default: true }
        },
        dashboard: {
            view: { type: Boolean, default: true },
            analytics: { type: Boolean, default: true }
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: Date,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.password;
            return ret;
        }
    }
});

// Indexes
adminSchema.index({ username: 1 }, { unique: true });
adminSchema.index({ isActive: 1 });

// Virtual for account locked
adminSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to handle failed login attempts
adminSchema.methods.incLoginAttempts = async function () {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $unset: { lockUntil: 1 },
            $set: { loginAttempts: 1 }
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // Lock account after 5 failed attempts for 2 hours
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
    }

    return this.updateOne(updates);
};

// Method to reset login attempts
adminSchema.methods.resetLoginAttempts = async function () {
    return this.updateOne({
        $unset: { loginAttempts: 1, lockUntil: 1 }
    });
};

// Static method to create default admin
adminSchema.statics.createDefaultAdmin = async function () {
    const existingAdmin = await this.findOne({ username: 'admin' });
    if (existingAdmin) return existingAdmin;

    const defaultAdmin = new this({
        username: 'admin',
        password: 'admin123',
        role: 'super_admin',
        permissions: {
            users: { view: true, edit: true, block: true, delete: true },
            rooms: { view: true, edit: true, declare_winner: true, cancel: true },
            transactions: { view: true, edit: true, refund: true },
            dashboard: { view: true, analytics: true }
        }
    });

    await defaultAdmin.save();
    console.log('✅ Default admin created - Username: admin, Password: admin123');
    return defaultAdmin;
};

export default mongoose.model('Admin', adminSchema);
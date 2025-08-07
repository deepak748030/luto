import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: 'Please enter a valid 10-digit phone number'
    }
  },
  otp: {
    type: String,
    required: [true, 'OTP is required'],
    validate: {
      validator: function(v) {
        return /^\d{6}$/.test(v);
      },
      message: 'OTP must be 6 digits'
    }
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0,
    max: [3, 'Maximum 3 verification attempts allowed']
  },
  purpose: {
    type: String,
    enum: ['signup', 'login', 'forgot_password'],
    default: 'signup'
  }
}, {
  timestamps: true
});

// Indexes for performance
otpSchema.index({ phone: 1, isUsed: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to verify OTP
otpSchema.methods.verify = function(providedOtp) {
  if (this.isUsed) {
    throw new Error('OTP has already been used');
  }
  
  if (new Date() > this.expiresAt) {
    throw new Error('OTP has expired');
  }
  
  if (this.attempts >= 3) {
    throw new Error('Maximum verification attempts exceeded');
  }
  
  this.attempts += 1;
  
  if (this.otp !== providedOtp) {
    throw new Error('Invalid OTP');
  }
  
  this.isUsed = true;
  return true;
};

// Static method to generate and save OTP
otpSchema.statics.generateAndSave = async function(phone, purpose = 'signup') {
  // Invalidate any existing unused OTPs for this phone
  await this.updateMany(
    { phone, isUsed: false },
    { isUsed: true }
  );
  
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiry time
  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  
  // Create and save OTP
  const otpDoc = new this({
    phone,
    otp,
    expiresAt,
    purpose
  });
  
  await otpDoc.save();
  return otpDoc;
};

export default mongoose.model('OTP', otpSchema);
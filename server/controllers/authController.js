import User from '../models/User.js';
import OTP from '../models/OTP.js';
import { generateToken } from '../utils/jwt.js';
import { sendOtpViaSMS } from '../utils/otpService.js';
import { cache, cacheUtils } from '../utils/cache.js';

export const signup = async (req, res) => {
  try {
    const { name, phone } = req.body;

    // Validate input
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone number are required'
      });
    }

    // Validate phone format (10 digits starting with 6-9)
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit phone number'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    // Generate and save OTP (for production use)
    let otpDoc;
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Development mode: Skipping SMS, using dummy OTP');
      // Create a dummy OTP for development
      otpDoc = { otp: '123456' };
    } else {
      otpDoc = await OTP.generateAndSave(phone, 'signup');

      // Send OTP via SMS
      const smsResult = await sendOtpViaSMS(phone, otpDoc.otp);

      if (!smsResult.status) {
        console.error('Failed to send OTP:', smsResult.message);
        // Still return success to prevent exposing SMS service issues
      }
    }

    // Cache signup data temporarily
    const signupData = { name, phone };
    cache.set(`signup_${phone}`, signupData, 600); // 10 minutes

    res.status(200).json({
      success: true,
      message: process.env.NODE_ENV === 'development'
        ? 'OTP bypassed for development (use any 6-digit number)'
        : 'OTP sent successfully',
      data: {
        phone,
        otpSent: true,
        expiresIn: '5 minutes',
        ...(process.env.NODE_ENV === 'development' && {
          devNote: 'Development mode: Use any 6-digit OTP'
        })
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate signup process'
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp, password } = req.body;

    // Validate input
    if (!phone || !otp || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone, OTP, and password are required'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Get signup data from cache
    const signupData = cache.get(`signup_${phone}`);
    if (!signupData) {
      return res.status(400).json({
        success: false,
        message: 'Signup session expired. Please start again.'
      });
    }

    // DEVELOPMENT: Bypass OTP verification - accept any 6-digit OTP
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Development mode: Bypassing OTP verification');
      console.log(`📱 Phone: ${phone}, OTP: ${otp} (accepted)`);
    } else {
      // Production OTP verification
      const otpDoc = await OTP.findOne({
        phone,
        isUsed: false,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      if (!otpDoc) {
        return res.status(400).json({
          success: false,
          message: 'OTP expired or not found'
        });
      }

      // Verify OTP
      try {
        otpDoc.verify(otp);
        await otpDoc.save();
      } catch (otpError) {
        return res.status(400).json({
          success: false,
          message: otpError.message
        });
      }
    }

    // Create new user
    const user = new User({
      name: signupData.name,
      phone,
      password,
      isVerified: true
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Clear cache
    cache.del(`signup_${phone}`);

    // Cache user data
    cache.set(cacheUtils.userKey(user._id), user, 300);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          balance: user.balance,
          isVerified: user.isVerified
        },
        token
      }
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP and create account'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Validate input
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password are required'
      });
    }

    // Find user by phone
    const user = await User.findOne({ phone, isActive: true });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Cache user data
    cache.set(cacheUtils.userKey(user._id), user, 300);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          balance: user.balance,
          totalGames: user.totalGames,
          totalWins: user.totalWins,
          totalWinnings: user.totalWinnings,
          winRate: user.winRate,
          isVerified: user.isVerified
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if signup data exists in cache
    const signupData = cache.get(`signup_${phone}`);
    if (!signupData) {
      return res.status(400).json({
        success: false,
        message: 'Signup session not found. Please start signup again.'
      });
    }

    // Generate and save new OTP
    const otpDoc = await OTP.generateAndSave(phone, 'signup');

    // Send OTP via SMS
    const smsResult = await sendOtpViaSMS(phone, otpDoc.otp);

    if (!smsResult.status) {
      console.error('Failed to resend OTP:', smsResult.message);
    }

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully',
      data: {
        phone,
        expiresIn: '5 minutes'
      }
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP'
    });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.user._id;

    // Clear user cache
    cacheUtils.clearUserCache(userId);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};
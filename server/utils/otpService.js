import twilio from 'twilio';
import dotenv from 'dotenv'
dotenv.config();


console.log({
    "accountssid": process.env.TWILIO_ACCOUNT_SID,
    "authtoken": process.env.TWILIO_AUTH_TOKEN,
    "phone": process.env.TWILIO_PHONE_NUMBER,
    "apikey": process.env.TWILIO_API_KEY
});
// Initialize Twilio client with better error handling
let client;
try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.error('❌ Twilio credentials missing. Please check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.');
        throw new Error('Twilio credentials not configured');
    }

    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio client initialized successfully');
} catch (error) {
    console.error('❌ Failed to initialize Twilio client:', error.message);
}

/**
 * Validate Indian mobile number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid Indian mobile number
 */
export const validateIndianMobileNumber = (phone) => {
    // Remove any spaces, dashes, or other non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');

    // Check if it's a valid 10-digit Indian mobile number starting with 6-9
    if (/^[6-9]\d{9}$/.test(cleanPhone)) {
        return true;
    }

    // Check if it's in international format (+91 followed by 10 digits)
    if (/^91[6-9]\d{9}$/.test(cleanPhone)) {
        return true;
    }

    return false;
};

/**
 * Format phone number for Twilio (add +91 country code if not present)
 * @param {string} phone - Phone number to format
 * @returns {string} - Formatted phone number with country code
 */
export const formatPhoneForTwilio = (phone) => {
    const cleanPhone = phone.replace(/\D/g, '');

    // If it's a 10-digit number, add +91
    if (/^[6-9]\d{9}$/.test(cleanPhone)) {
        return `+91${cleanPhone}`;
    }

    // If it already has 91 prefix, add +
    if (/^91[6-9]\d{9}$/.test(cleanPhone)) {
        return `+${cleanPhone}`;
    }

    // Return as is if already formatted
    return phone;
};

/**
 * Send OTP via Twilio SMS
 * @param {string} phone - Phone number (Indian format)
 * @param {string} otp - OTP code to send
 * @returns {Promise<Object>} - Result object with status and message
 */
export const sendOtpViaSMS = async (phone, otp) => {
    try {
        // Check if Twilio client is initialized
        if (!client) {
            console.error('Twilio client not initialized. Please check your credentials.');
            return {
                status: false,
                message: 'SMS service not configured properly'
            };
        }

        // Validate Indian mobile number
        if (!validateIndianMobileNumber(phone)) {
            console.error('Invalid Indian mobile number:', phone);
            return {
                status: false,
                message: 'Invalid Indian mobile number format'
            };
        }

        // Format phone number for Twilio
        const formattedPhone = formatPhoneForTwilio(phone);

        console.log(`Sending OTP ${otp} to phone ${formattedPhone} via Twilio`);

        // Validate required environment variables
        if (!process.env.TWILIO_PHONE_NUMBER) {
            console.error('TWILIO_PHONE_NUMBER not configured');
            return {
                status: false,
                message: 'SMS service configuration incomplete'
            };
        }

        // Create SMS message
        const message = `Your LUDO LOOTO verification code is: ${otp}. This code will expire in 5 minutes. Do not share this code with anyone.`;

        // Send SMS via Twilio
        const twilioResponse = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedPhone
        });

        console.log('Twilio SMS Response:', {
            sid: twilioResponse.sid,
            status: twilioResponse.status,
            to: formattedPhone,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        // Check if message was sent successfully
        if (twilioResponse.sid && (twilioResponse.status === 'queued' || twilioResponse.status === 'sent')) {
            return {
                status: true,
                message: 'OTP sent successfully',
                messageSid: twilioResponse.sid,
                twilioStatus: twilioResponse.status
            };
        } else {
            console.error('Twilio message failed:', twilioResponse);
            return {
                status: false,
                message: 'Failed to send OTP via SMS'
            };
        }

    } catch (error) {
        console.error('Twilio SMS Error:', {
            message: error.message,
            code: error.code,
            moreInfo: error.moreInfo || 'No additional info',
            status: error.status || 'No status',
            phone: phone,
            accountSid: process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Missing',
            authToken: process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Missing',
            phoneNumber: process.env.TWILIO_PHONE_NUMBER ? 'Set' : 'Missing'
        });

        // Handle specific Twilio errors
        let errorMessage = 'Failed to send OTP. Please try again.';

        if (error.code === 21211) {
            errorMessage = 'Invalid phone number format';
        } else if (error.code === 21614) {
            errorMessage = 'Invalid phone number - not a mobile number';
        } else if (error.code === 21408) {
            errorMessage = 'Permission denied - unable to send to this number';
        } else if (error.code === 20003) {
            errorMessage = 'Authentication error - please check Twilio credentials';
        } else if (error.code === 21606) {
            errorMessage = 'Phone number is not verified for trial account';
        }

        // Add more specific error for authentication issues
        if (error.message && error.message.includes('username')) {
            errorMessage = 'Twilio authentication failed - please check Account SID and Auth Token';
        }

        return {
            status: false,
            message: errorMessage,
            error: error.message,
            code: error.code
        };
    }
};

/**
 * Generate 6-digit OTP
 * @returns {string} - 6-digit OTP
 */
export const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Verify phone number format for Indian numbers only
 * @param {string} phone - Phone number to verify
 * @returns {Object} - Validation result
 */
export const verifyIndianPhoneNumber = (phone) => {
    const cleanPhone = phone.replace(/\D/g, '');

    // Check various formats
    const formats = [
        {
            pattern: /^[6-9]\d{9}$/,
            description: '10-digit mobile number starting with 6-9',
            example: '9876543210'
        },
        {
            pattern: /^91[6-9]\d{9}$/,
            description: 'With country code 91',
            example: '919876543210'
        }
    ];

    for (const format of formats) {
        if (format.pattern.test(cleanPhone)) {
            return {
                valid: true,
                format: format.description,
                cleanNumber: cleanPhone,
                formattedNumber: formatPhoneForTwilio(cleanPhone)
            };
        }
    }

    return {
        valid: false,
        error: 'Invalid Indian mobile number format',
        expectedFormats: formats.map(f => f.example),
        received: phone
    };
};

/**
 * Check Twilio account status and balance
 * @returns {Promise<Object>} - Account information
 */
export const checkTwilioStatus = async () => {
    try {
        if (!client) {
            return {
                status: false,
                error: 'Twilio client not initialized'
            };
        }

        const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();

        return {
            status: true,
            accountSid: account.sid,
            accountStatus: account.status,
            type: account.type,
            dateCreated: account.dateCreated
        };
    } catch (error) {
        console.error('Twilio status check error:', error);
        return {
            status: false,
            error: error.message,
            details: {
                accountSid: process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Missing',
                authToken: process.env.TWILIO_AUTH_TOKEN ? 'Configured' : 'Missing',
                phoneNumber: process.env.TWILIO_PHONE_NUMBER ? 'Configured' : 'Missing'
            }
        };
    }
};
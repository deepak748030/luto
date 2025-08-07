import axios from 'axios';
import FormData from 'form-data';

export const sendOtpViaSMS = async (phone, otp) => {
    try {
        const form = new FormData();
        form.append('otp', otp);
        form.append('type', 'SMS');
        form.append('numberOrMail', phone); // Don't add +91 as per your requirement

        const res = await axios.post(
            'https://api.codemindstudio.in/api/start_verification',
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'Api-Key': process.env.SMS_API_KEY,
                    'Api-Salt': process.env.SMS_API_SALT
                },
                timeout: 10000 // 10 second timeout
            }
        );

        console.log('OTP SMS Response:', res.data);
        return res.data; // { message, status }
    } catch (err) {
        console.error('OTP SMS Error:', err.message);
        return { message: 'OTP sending failed', status: false };
    }
};

export const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
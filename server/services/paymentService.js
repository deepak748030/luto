// Fake Payment Service for Testing
// In production, integrate with actual payment gateways like Razorpay, Paytm, etc.

export class PaymentService {
  // Create fake payment order
  static async createOrder(amount, currency = 'INR', userId) {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // In real implementation, this would be a call to payment gateway
      // const order = await razorpay.orders.create({
      //   amount: amount * 100, // Amount in paise
      //   currency,
      //   receipt: orderId
      // });
      
      return {
        orderId,
        amount,
        currency,
        status: 'created',
        key: process.env.PAYMENT_GATEWAY_KEY || 'fake_key_for_testing'
      };
    } catch (error) {
      console.error('Payment order creation failed:', error);
      throw new Error('Failed to create payment order');
    }
  }
  
  // Verify fake payment
  static async verifyPayment(orderId, paymentId, signature) {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // In real implementation, verify the payment signature
      // const body = orderId + '|' + paymentId;
      // const expectedSignature = crypto
      //   .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      //   .update(body.toString())
      //   .digest('hex');
      // const isAuthentic = expectedSignature === signature;
      
      // For testing, always return success
      const isAuthentic = true;
      
      if (!isAuthentic) {
        throw new Error('Payment verification failed');
      }
      
      return {
        orderId,
        paymentId,
        status: 'success',
        amount: Math.floor(Math.random() * 10000) + 100, // Random amount for testing
        verified: true
      };
    } catch (error) {
      console.error('Payment verification failed:', error);
      throw new Error('Payment verification failed');
    }
  }
  
  // Process withdrawal (fake)
  static async processWithdrawal(upiId, amount, transactionId) {
    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In real implementation, process withdrawal to UPI
      // const withdrawal = await paymentGateway.transfer({
      //   account: upiId,
      //   amount: amount * 100,
      //   currency: 'INR',
      //   notes: { transactionId }
      // });
      
      // For testing, randomly succeed or fail
      const success = Math.random() > 0.1; // 90% success rate
      
      if (!success) {
        throw new Error('Withdrawal processing failed');
      }
      
      return {
        transactionId,
        upiId,
        amount,
        status: 'completed',
        processedAt: new Date()
      };
    } catch (error) {
      console.error('Withdrawal processing failed:', error);
      throw new Error('Withdrawal processing failed');
    }
  }
  
  // Get payment status
  static async getPaymentStatus(paymentId) {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // In real implementation, get payment status from gateway
      return {
        paymentId,
        status: 'captured', // or 'failed', 'pending'
        method: 'upi',
        amount: Math.floor(Math.random() * 10000) + 100
      };
    } catch (error) {
      console.error('Failed to get payment status:', error);
      throw new Error('Failed to get payment status');
    }
  }
}
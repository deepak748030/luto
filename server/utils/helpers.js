export const generateRoomId = () => {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `LK${randomNum}`;
};

export const calculateWinnings = (totalAmount, platformFeePercent = 10) => {
  const platformFee = Math.floor(totalAmount * platformFeePercent / 100);
  const winnerAmount = totalAmount - platformFee;

  return {
    totalAmount,
    platformFee,
    winnerAmount
  };
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const validatePhoneNumber = (phone) => {
  const cleanPhone = phone.replace(/\D/g, '');
  // Support both 10-digit and international format with +91
  return /^[6-9]\d{9}$/.test(cleanPhone) || /^91[6-9]\d{9}$/.test(cleanPhone);
};

export const normalizePhoneNumber = (phone) => {
  const cleanPhone = phone.replace(/\D/g, '');

  // If it's international format (91xxxxxxxxxx), remove country code
  if (/^91[6-9]\d{9}$/.test(cleanPhone)) {
    return cleanPhone.substring(2);
  }

  // If it's 10-digit format, return as is
  if (/^[6-9]\d{9}$/.test(cleanPhone)) {
    return cleanPhone;
  }

  return phone; // Return original if no valid format found
};

export const validateUPI = (upiId) => {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upiId);
};

export const sanitizeUser = (user) => {
  const { password, ...sanitized } = user.toObject ? user.toObject() : user;
  return sanitized;
};

export const getPagination = (page = 1, limit = 20) => {
  const currentPage = Math.max(1, parseInt(page));
  const currentLimit = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (currentPage - 1) * currentLimit;

  return {
    page: currentPage,
    limit: currentLimit,
    skip
  };
};

export const buildPaginationResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};
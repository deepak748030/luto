# LUDO LOOTO - Backend API

A complete backend API for the LUDO LOOTO gaming platform built with Node.js, Express, and MongoDB.

## 📚 Quick Start

1. **Start the server**: `npm run dev`
2. **Visit API Documentation**: `http://localhost:5000/api-docs`
3. **Health Check**: `http://localhost:5000/health`

## 🔗 Base URL

- **Development**: `http://localhost:5000`
- **Production**: `https://your-domain.com`

## 📋 API Response Format

All API responses follow this consistent format:

```json
{
  "success": true|false,
  "message": "Response message",
  "data": {
    // Response data (only present on success)
  },
  "errors": [
    // Validation errors (only present on validation failures)
    {
      "field": "fieldName",
      "message": "Error message"
    }
  ]
}
```

## 🔐 Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📖 Complete API Reference

### 1. Authentication APIs

#### 1.1 User Signup

**Endpoint**: `POST /api/auth/signup`

**Description**: Register a new user and send OTP for verification

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "phone": "9876543210"
}
```

**Request Validation**:
- `phone`: Required, 10-digit number starting with 6-9

**Success Response** (200):
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phone": "9876543210",
    "otpSent": true,
    "expiresIn": "5 minutes"
  }
}
```

**Error Responses**:

*Validation Error (400)*:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "phone",
      "message": "Please enter a valid 10-digit phone number"
    }
  ]
}
```

*User Already Exists (400)*:
```json
{
  "success": false,
  "message": "User with this phone number already exists"
}
```

*OTP Sending Failed (500)*:
```json
{
  "success": false,
  "message": "Failed to send OTP. Please try again."
}
```

#### 1.2 Verify OTP

**Endpoint**: `POST /api/auth/verify-otp`

**Description**: Verify OTP and complete user registration

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "phone": "9876543210",
  "otp": "123456",
  "name": "John Doe",
  "password": "password123"
}
```

**Request Validation**:
- `phone`: Required, 10-digit number starting with 6-9
- `otp`: Required, 6-digit number
- `name`: Required, 2-50 characters
- `password`: Required, minimum 6 characters

**Success Response** (201):
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "_id": "60d5ecb74b24a1234567890a",
      "name": "John Doe",
      "phone": "9876543210",
      "balance": 0,
      "isVerified": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**:

*Invalid OTP (400)*:
```json
{
  "success": false,
  "message": "Invalid OTP"
}
```

*OTP Expired (400)*:
```json
{
  "success": false,
  "message": "OTP has expired"
}
```

*Session Expired (400)*:
```json
{
  "success": false,
  "message": "Signup session expired. Please start again."
}
```

#### 1.3 Send OTP for Login

**Endpoint**: `POST /api/auth/send-otp`

**Description**: Send OTP to existing user for login

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "phone": "9876543210"
}
```

**Request Validation**:
- `phone`: Required, 10-digit number starting with 6-9

**Success Response** (200):
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phone": "9876543210",
    "otpSent": true,
    "expiresIn": "5 minutes"
  }
}
```

**Error Responses**:

*Invalid Phone Number (400)*:
```json
{
  "success": false,
  "message": "Please enter a valid Indian mobile number"
}
```

*OTP Sending Failed (500)*:
```json
{
  "success": false,
  "message": "Failed to send OTP. Please try again."
}
```

#### 1.4 Verify OTP for Login

**Endpoint**: `POST /api/auth/verify-otp-login`

**Description**: Verify OTP and login existing user

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

**Request Validation**:
- `phone`: Required, 10-digit number starting with 6-9
- `otp`: Required, 6-digit number

**Success Response** (200):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "60d5ecb74b24a1234567890a",
      "name": "John Doe",
      "phone": "9876543210",
      "balance": 1500.50,
      "totalGames": 25,
      "totalWins": 15,
      "totalWinnings": 5000,
      "winRate": 60,
      "isVerified": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**:

*Invalid OTP (400)*:
```json
{
  "success": false,
  "message": "Invalid OTP"
}
```

*User Not Found (404)*:
```json
{
  "success": false,
  "message": "User not found. Please register first."
}
```

#### 1.5 User Login (Password-based)

**Endpoint**: `POST /api/auth/login`

**Description**: Login existing user with password

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "phone": "9876543210",
  "password": "password123"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "60d5ecb74b24a1234567890a",
      "name": "John Doe",
      "phone": "9876543210",
      "balance": 1500.50,
      "totalGames": 25,
      "totalWins": 15,
      "totalWinnings": 5000,
      "winRate": 60,
      "isVerified": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**:

*Invalid Credentials (401)*:
```json
{
  "success": false,
  "message": "Invalid phone or password"
}
```

#### 1.6 Resend OTP

**Endpoint**: `POST /api/auth/resend-otp`

**Request Body**:
```json
{
  "phone": "9876543210"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "OTP resent successfully",
  "data": {
    "phone": "9876543210",
    "expiresIn": "5 minutes"
  }
}
```

#### 1.7 Logout

**Endpoint**: `POST /api/auth/logout`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 2. User Management APIs

#### 2.1 Get User Profile

**Endpoint**: `GET /api/user/profile`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "60d5ecb74b24a1234567890a",
      "name": "John Doe",
      "phone": "9876543210",
      "balance": 1500.50,
      "totalGames": 25,
      "totalWins": 15,
      "totalWinnings": 5000,
      "winRate": 60,
      "isVerified": true,
      "createdAt": "2023-06-25T10:30:00.000Z"
    }
  }
}
```

#### 2.2 Update Profile

**Endpoint**: `PUT /api/user/profile`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "John Doe Updated"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "_id": "60d5ecb74b24a1234567890a",
      "name": "John Doe Updated",
      "phone": "9876543210",
      "balance": 1500.50
    }
  }
}
```

#### 2.3 Change Password

**Endpoint**: `PUT /api/user/change-password`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Response** (400):
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

### 3. Wallet Management APIs

#### 3.1 Get Wallet Balance

**Endpoint**: `GET /api/wallet/balance`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "balance": 1500.50,
    "lastUpdated": "2023-06-25T10:30:00.000Z"
  }
}
```

#### 3.2 Add Money to Wallet

**Endpoint**: `POST /api/wallet/add-money`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "amount": 500,
  "paymentMethod": "upi"
}
```

**Request Validation**:
- `amount`: Required, 1-100000
- `paymentMethod`: Optional, one of: fake, upi, card, netbanking

**Success Response** (200):
```json
{
  "success": true,
  "message": "Money added successfully",
  "data": {
    "transaction": {
      "_id": "60d5ecb74b24a1234567890b",
      "amount": 500,
      "newBalance": 2000.50,
      "transactionId": "TXN1687689000123",
      "status": "completed"
    }
  }
}
```

**Error Response** (400):
```json
{
  "success": false,
  "message": "Payment verification failed"
}
```

#### 3.3 Withdraw Money

**Endpoint**: `POST /api/wallet/withdraw`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "amount": 1000,
  "upiId": "user@paytm"
}
```

**Request Validation**:
- `amount`: Required, 100-50000
- `upiId`: Required, valid UPI ID format

**Success Response** (200):
```json
{
  "success": true,
  "message": "Withdrawal processed successfully",
  "data": {
    "transaction": {
      "_id": "60d5ecb74b24a1234567890c",
      "amount": 1000,
      "newBalance": 1000.50,
      "transactionId": "TXN1687689000124",
      "status": "completed",
      "upiId": "user@paytm"
    }
  }
}
```

**Error Responses**:

*Insufficient Balance (400)*:
```json
{
  "success": false,
  "message": "Insufficient balance"
}
```

*Invalid UPI ID (400)*:
```json
{
  "success": false,
  "message": "Please enter a valid UPI ID"
}
```

#### 3.4 Get Transaction History

**Endpoint**: `GET /api/wallet/transactions`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `type`: Optional, filter by type (all, deposit, withdrawal, game_win, game_loss, refund)
- `page`: Optional, page number (default: 1)
- `limit`: Optional, items per page (default: 20, max: 100)

**Example**: `GET /api/wallet/transactions?type=deposit&page=1&limit=10`

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "_id": "60d5ecb74b24a1234567890b",
        "type": "deposit",
        "amount": 500,
        "description": "Money Added to Wallet",
        "status": "completed",
        "balanceBefore": 1500.50,
        "balanceAfter": 2000.50,
        "transactionId": "TXN1687689000123",
        "createdAt": "2023-06-25T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 4. Game Room APIs

#### 4.1 Get Available Rooms

**Endpoint**: `GET /api/rooms`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `status`: Optional, filter by status (all, waiting, playing, completed, cancelled)
- `page`: Optional, page number (default: 1)
- `limit`: Optional, items per page (default: 20, max: 50)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "_id": "60d5ecb74b24a1234567890d",
        "roomId": "LK123456",
        "gameType": "Ludo",
        "amount": 100,
        "maxPlayers": 4,
        "currentPlayers": 2,
        "players": [
          {
            "userId": {
              "_id": "60d5ecb74b24a1234567890a",
              "name": "John Doe"
            },
            "name": "John Doe",
            "joinedAt": "2023-06-25T10:30:00.000Z"
          }
        ],
        "status": "waiting",
        "createdBy": {
          "_id": "60d5ecb74b24a1234567890a",
          "name": "John Doe"
        },
        "createdAt": "2023-06-25T10:30:00.000Z",
        "isJoined": false,
        "isCreator": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "pages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

#### 4.2 Create Game Room

**Endpoint**: `POST /api/rooms/create`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "gameType": "Ludo",
  "amount": 100,
  "maxPlayers": 4
}
```

**Request Validation**:
- `gameType`: Optional, one of: Ludo, Snakes & Ladders, Carrom (default: Ludo)
- `amount`: Required, 10-10000
- `maxPlayers`: Optional, 2-4 (default: 4)

**Success Response** (201):
```json
{
  "success": true,
  "message": "Room created successfully",
  "data": {
    "room": {
      "_id": "60d5ecb74b24a1234567890d",
      "roomId": "LK123456",
      "gameType": "Ludo",
      "amount": 100,
      "maxPlayers": 4,
      "currentPlayers": 1,
      "players": [
        {
          "userId": {
            "_id": "60d5ecb74b24a1234567890a",
            "name": "John Doe"
          },
          "name": "John Doe",
          "joinedAt": "2023-06-25T10:30:00.000Z"
        }
      ],
      "status": "waiting",
      "createdBy": {
        "_id": "60d5ecb74b24a1234567890a",
        "name": "John Doe"
      },
      "createdAt": "2023-06-25T10:30:00.000Z",
      "isCreator": true,
      "isJoined": true
    }
  }
}
```

**Error Response** (400):
```json
{
  "success": false,
  "message": "Insufficient balance to create room"
}
```

#### 4.3 Join Game Room

**Endpoint**: `POST /api/rooms/{roomId}/join`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters**:
- `roomId`: Required, room code (e.g., LK123456)

**Success Response** (200):
```json
{
  "success": true,
  "message": "Joined room successfully",
  "data": {
    "room": {
      "_id": "60d5ecb74b24a1234567890d",
      "roomId": "LK123456",
      "gameType": "Ludo",
      "amount": 100,
      "maxPlayers": 4,
      "currentPlayers": 2,
      "players": [
        {
          "userId": "60d5ecb74b24a1234567890a",
          "name": "John Doe",
          "joinedAt": "2023-06-25T10:30:00.000Z"
        },
        {
          "userId": "60d5ecb74b24a1234567890b",
          "name": "Jane Smith",
          "joinedAt": "2023-06-25T10:35:00.000Z"
        }
      ],
      "status": "waiting"
    }
  }
}
```

**Error Responses**:

*Room Not Found (404)*:
```json
{
  "success": false,
  "message": "Room not found"
}
```

*Room Full (400)*:
```json
{
  "success": false,
  "message": "Room is full"
}
```

*Already Joined (400)*:
```json
{
  "success": false,
  "message": "You are already in this room"
}
```

*Insufficient Balance (400)*:
```json
{
  "success": false,
  "message": "Insufficient balance to join room"
}
```

#### 4.4 Declare Winner

**Endpoint**: `PUT /api/rooms/{roomId}/declare-winner`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "winnerId": "60d5ecb74b24a1234567890a"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Winner declared successfully. Waiting for admin verification.",
  "data": {
    "room": {
      "_id": "60d5ecb74b24a1234567890d",
      "roomId": "LK123456",
      "status": "winner_declared",
      "winner": "60d5ecb74b24a1234567890a",
      "declaredAt": "2023-06-25T11:00:00.000Z"
    },
    "pendingWinnings": {
      "amount": 360,
      "totalPrizePool": 400,
      "platformFee": 40
    },
    "requestId": "60d5ecb74b24a1234567890e",
    "message": "Your winner declaration is pending admin verification. You will receive the winnings once approved."
  }
}
```

#### 4.5 Get My Rooms

**Endpoint**: `GET /api/rooms/my-rooms`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `status`: Optional, filter by status (all, waiting, playing, completed, cancelled)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "_id": "60d5ecb74b24a1234567890d",
        "roomId": "LK123456",
        "gameType": "Ludo",
        "amount": 100,
        "status": "completed",
        "isCreator": true,
        "isWinner": true,
        "userPosition": 1,
        "createdAt": "2023-06-25T10:30:00.000Z"
      }
    ]
  }
}
```

### 5. Transaction APIs

#### 5.1 Get Transaction History

**Endpoint**: `GET /api/transactions/history`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `type`: Optional, filter by type (all, deposit, withdrawal, game_win, game_loss, refund)
- `page`: Optional, page number (default: 1)
- `limit`: Optional, items per page (default: 20, max: 100)
- `startDate`: Optional, start date filter (ISO format)
- `endDate`: Optional, end date filter (ISO format)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "_id": "60d5ecb74b24a1234567890b",
        "type": "game_win",
        "amount": 360,
        "description": "Game Won - Room LK123456",
        "status": "completed",
        "balanceBefore": 1500.50,
        "balanceAfter": 1860.50,
        "transactionId": "TXN1687689000123",
        "gameRoom": {
          "roomId": "LK123456",
          "gameType": "Ludo",
          "status": "completed"
        },
        "createdAt": "2023-06-25T11:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalDeposits": 5000,
      "totalWithdrawals": 2000,
      "totalGameWinnings": 3600,
      "totalGameLosses": 1500,
      "totalRefunds": 100
    }
  }
}
```

#### 5.2 Get Transaction Statistics

**Endpoint**: `GET /api/transactions/stats`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters**:
- `period`: Optional, time period (7d, 30d, 90d, 1y) (default: 30d)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "startDate": "2023-05-25T10:30:00.000Z",
    "endDate": "2023-06-25T10:30:00.000Z",
    "summary": {
      "deposit": {
        "totalAmount": 5000,
        "totalCount": 10,
        "averageAmount": 500
      },
      "game_win": {
        "totalAmount": 3600,
        "totalCount": 15,
        "averageAmount": 240
      }
    },
    "chartData": {
      "deposit": [
        {
          "date": "2023-06-20",
          "amount": 500,
          "count": 1
        }
      ]
    }
  }
}
```

### 6. Dashboard APIs

#### 6.1 Get Dashboard Statistics

**Endpoint**: `GET /api/dashboard/stats`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "balance": 1500.50,
    "stats": {
      "totalGames": 25,
      "totalWins": 15,
      "totalWinnings": 5000,
      "winRate": 60
    },
    "monthlyStats": {
      "deposits": 2000,
      "withdrawals": 1000,
      "gameWinnings": 1800,
      "gameLosses": 800,
      "gamesPlayed": 10
    },
    "recentActivity": [
      {
        "_id": "60d5ecb74b24a1234567890b",
        "type": "game_win",
        "amount": 360,
        "description": "Game Won - Room LK123456",
        "roomId": "LK123456",
        "status": "completed",
        "createdAt": "2023-06-25T11:00:00.000Z"
      }
    ],
    "activeRooms": [
      {
        "_id": "60d5ecb74b24a1234567890d",
        "roomId": "LK123456",
        "gameType": "Ludo",
        "amount": 100,
        "currentPlayers": 3,
        "maxPlayers": 4,
        "status": "waiting",
        "isCreator": true,
        "createdAt": "2023-06-25T10:30:00.000Z"
      }
    ],
    "quickStats": {
      "netProfitThisMonth": 1000,
      "totalDepositsThisMonth": 2000,
      "gamesPlayedThisMonth": 10
    }
  }
}
```

## 🚨 Error Handling

### Common HTTP Status Codes

- **200**: Success
- **201**: Created successfully
- **400**: Bad request / Validation error
- **401**: Unauthorized / Invalid token
- **403**: Forbidden / Access denied
- **404**: Resource not found
- **500**: Internal server error

### Authentication Errors

**Invalid/Missing Token (401)**:
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

**Expired Token (401)**:
```json
{
  "success": false,
  "message": "Token expired"
}
```

**User Not Found (401)**:
```json
{
  "success": false,
  "message": "User not found or inactive."
}
```

### Validation Errors

**Multiple Field Errors (400)**:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Name is required"
    },
    {
      "field": "phone",
      "message": "Please enter a valid 10-digit phone number"
    }
  ]
}
```

## 🔧 Integration Guide

### 1. Setup Base Configuration

```javascript
const API_BASE_URL = 'http://localhost:5000';

// API client setup
const apiClient = {
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Add auth token to requests
const setAuthToken = (token) => {
  if (token) {
    apiClient.headers['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.headers['Authorization'];
  }
};
```

### 2. Authentication Flow

```javascript
// Step 1: Signup (only phone number needed)
const signup = async (phone) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: apiClient.headers,
    body: JSON.stringify({ phone })
  });
  return response.json();
};

// Step 2: Verify OTP and complete registration
const verifyOtp = async (phone, otp, name, password) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: apiClient.headers,
    body: JSON.stringify({ phone, otp, name, password })
  });
  const data = await response.json();
  
  if (data.success) {
    // Store token for future requests
    localStorage.setItem('authToken', data.data.token);
    setAuthToken(data.data.token);
  }
  
  return data;
};

// Step 3: Send OTP for Login
const sendOtpForLogin = async (phone) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: apiClient.headers,
    body: JSON.stringify({ phone })
  });
  return response.json();
};

// Step 4: Verify OTP and Login
const verifyOtpLogin = async (phone, otp) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp-login`, {
    method: 'POST',
    headers: apiClient.headers,
    body: JSON.stringify({ phone, otp })
  });
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('authToken', data.data.token);
    setAuthToken(data.data.token);
  }
  
  return data;
};

// Step 5: Password-based Login (Alternative)
const login = async (phone, password) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: apiClient.headers,
    body: JSON.stringify({ phone, password })
  });
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('authToken', data.data.token);
    setAuthToken(data.data.token);
  }
  
  return data;
};
```

### 3. Making Authenticated Requests

```javascript
// Get user profile
const getUserProfile = async () => {
  const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
    method: 'GET',
    headers: apiClient.headers
  });
  return response.json();
};

// Add money to wallet
const addMoney = async (amount, paymentMethod = 'upi') => {
  const response = await fetch(`${API_BASE_URL}/api/wallet/add-money`, {
    method: 'POST',
    headers: apiClient.headers,
    body: JSON.stringify({ amount, paymentMethod })
  });
  return response.json();
};

// Create game room
const createRoom = async (gameType, amount, maxPlayers) => {
  const response = await fetch(`${API_BASE_URL}/api/rooms/create`, {
    method: 'POST',
    headers: apiClient.headers,
    body: JSON.stringify({ gameType, amount, maxPlayers })
  });
  return response.json();
};
```

### 4. Error Handling

```javascript
const handleApiResponse = async (apiCall) => {
  try {
    const response = await apiCall();
    
    if (!response.success) {
      // Handle API errors
      if (response.errors) {
        // Validation errors
        response.errors.forEach(error => {
          console.error(`${error.field}: ${error.message}`);
        });
      } else {
        // General error
        console.error(response.message);
      }
      return { success: false, error: response.message };
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    // Network or other errors
    console.error('Network error:', error);
    return { success: false, error: 'Network error occurred' };
  }
};

// Usage
const result = await handleApiResponse(() => getUserProfile());
if (result.success) {
  console.log('User data:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### 5. Token Management

```javascript
// Initialize app with stored token
const initializeApp = () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    setAuthToken(token);
  }
};

// Handle token expiration
const handleTokenExpiration = () => {
  localStorage.removeItem('authToken');
  setAuthToken(null);
  // Redirect to login page
  window.location.href = '/login';
};

// Intercept 401 responses
const makeAuthenticatedRequest = async (url, options) => {
  const response = await fetch(url, options);
  
  if (response.status === 401) {
    handleTokenExpiration();
    return null;
  }
  
  return response.json();
};
```

## 🛠️ Development Setup

### Environment Variables

Create a `.env` file with the following variables:

```env
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ludo-looto

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_make_it_very_long_and_complex
JWT_EXPIRES_IN=7d

# SMS API (CodeMind Studio)
# SMS_API_KEY=your_sms_api_key
# SMS_API_SALT=your_sms_api_salt

# Twilio SMS API (Primary)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number_with_country_code
TWILIO_API_KEY=your_twilio_api_key

# App Settings
PLATFORM_FEE_PERCENTAGE=10
MIN_WITHDRAWAL_AMOUNT=100
MAX_WITHDRAWAL_AMOUNT=50000
OTP_EXPIRY_MINUTES=5

# Cache Settings
CACHE_TTL_SECONDS=300

# CORS
FRONTEND_URL=http://localhost:3000
```

### Installation & Running

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

### Testing the API

1. **Using Swagger UI**: Visit `http://localhost:5000/api-docs`
2. **Using Postman**: Import the API collection
3. **Using curl**: 

```bash
# Health check
curl http://localhost:5000/health

# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'

# Send OTP for login
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","password":"password123"}'
```

## 📱 Mobile App Integration

### React Native Example

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class ApiService {
  constructor() {
    this.baseURL = 'http://your-api-domain.com';
    this.token = null;
  }

  async setToken(token) {
    this.token = token;
    await AsyncStorage.setItem('authToken', token);
  }

  async getToken() {
    if (!this.token) {
      this.token = await AsyncStorage.getItem('authToken');
    }
    return this.token;
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getToken();
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    const data = await response.json();

    if (response.status === 401) {
      await this.clearToken();
      // Navigate to login screen
    }

    return data;
  }

  async clearToken() {
    this.token = null;
    await AsyncStorage.removeItem('authToken');
  }
}

export default new ApiService();
```

## 🏆 Winner Verification System

The API implements a two-step winner verification process:

### User Flow:
1. **Declare Winner**: Players can declare a winner using the existing API
2. **Pending Status**: Room status becomes `winner_declared` 
3. **No Balance Added**: Winner's balance is NOT updated immediately
4. **Wait for Verification**: Users receive a message about pending admin verification

### Admin Flow:
1. **Review Requests**: Admins see pending winner verification requests in dashboard
2. **Verify Details**: Admins can review room details, players, and game history
3. **Approve/Reject**: Admins can approve or reject winner declarations
4. **Balance Update**: Only after admin approval, winner receives the balance

### API Changes:
- `PUT /api/rooms/{roomId}/declare-winner` now creates a verification request
- New admin endpoints for managing winner verification requests
- Room status includes new `winner_declared` state
- Balance is only credited after admin approval

### Admin Endpoints:
- `GET /api/admin/winner-requests` - Get all winner verification requests
- `GET /api/admin/winner-requests/{requestId}` - Get specific request details
- `PUT /api/admin/winner-requests/{requestId}/approve` - Approve winner request
- `PUT /api/admin/winner-requests/{requestId}/reject` - Reject winner request

## 🔒 Security Best Practices

1. **Always use HTTPS in production**
2. **Store JWT tokens securely** (use secure storage on mobile)
3. **Implement token refresh mechanism**
4. **Validate all inputs on client side**
5. **Handle errors gracefully**
6. **Implement proper loading states**
7. **Use environment variables for API URLs**
8. **Winner verification prevents fraud** (admin approval required)

## 📞 Support

For API support and integration help:
- **Documentation**: `http://localhost:5000/api-docs`
- **Health Check**: `http://localhost:5000/health`
- **Email**: support@ludolooto.com

---

**Note**: 
- This API uses fake payment services for testing. In production, integrate with actual payment gateways like Razorpay, Paytm, or similar services.
- Winner verification system ensures fair play by requiring admin approval before crediting winnings.
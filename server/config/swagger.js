import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LUDO LOOTO API',
      version: '1.0.0',
      description: 'Complete backend API for LUDO LOOTO gaming platform with real money transactions',
      contact: {
        name: 'LUDO LOOTO Team',
        email: 'support@ludolooto.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.ludolooto.com' 
          : 'http://localhost:5000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from login endpoint'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID'
            },
            name: {
              type: 'string',
              description: 'User full name',
              minLength: 2,
              maxLength: 50
            },
            phone: {
              type: 'string',
              description: '10-digit phone number',
              pattern: '^[6-9]\\d{9}$'
            },
            balance: {
              type: 'number',
              description: 'Wallet balance in INR',
              minimum: 0
            },
            totalGames: {
              type: 'number',
              description: 'Total games played'
            },
            totalWins: {
              type: 'number',
              description: 'Total games won'
            },
            totalWinnings: {
              type: 'number',
              description: 'Total winnings in INR'
            },
            winRate: {
              type: 'number',
              description: 'Win rate percentage'
            },
            isVerified: {
              type: 'boolean',
              description: 'Phone verification status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        GameRoom: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Room ID'
            },
            roomId: {
              type: 'string',
              description: 'Room code (LK123456)',
              pattern: '^LK[0-9]{6}$'
            },
            gameType: {
              type: 'string',
              enum: ['Ludo', 'Snakes & Ladders', 'Carrom'],
              description: 'Type of game'
            },
            amount: {
              type: 'number',
              description: 'Entry amount per player',
              minimum: 10,
              maximum: 10000
            },
            maxPlayers: {
              type: 'number',
              description: 'Maximum players allowed',
              minimum: 2,
              maximum: 4
            },
            currentPlayers: {
              type: 'number',
              description: 'Current number of players'
            },
            players: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: {
                    type: 'string',
                    description: 'Player user ID'
                  },
                  name: {
                    type: 'string',
                    description: 'Player name'
                  },
                  joinedAt: {
                    type: 'string',
                    format: 'date-time'
                  }
                }
              }
            },
            status: {
              type: 'string',
              enum: ['waiting', 'playing', 'completed', 'cancelled'],
              description: 'Room status'
            },
            winner: {
              type: 'string',
              description: 'Winner user ID'
            },
            totalPrizePool: {
              type: 'number',
              description: 'Total prize pool'
            },
            winnerAmount: {
              type: 'number',
              description: 'Amount winner receives'
            },
            platformFee: {
              type: 'number',
              description: 'Platform fee deducted'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Transaction ID'
            },
            type: {
              type: 'string',
              enum: ['deposit', 'withdrawal', 'game_win', 'game_loss', 'refund'],
              description: 'Transaction type'
            },
            amount: {
              type: 'number',
              description: 'Transaction amount',
              minimum: 1
            },
            description: {
              type: 'string',
              description: 'Transaction description'
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed', 'failed', 'cancelled'],
              description: 'Transaction status'
            },
            balanceBefore: {
              type: 'number',
              description: 'Balance before transaction'
            },
            balanceAfter: {
              type: 'number',
              description: 'Balance after transaction'
            },
            transactionId: {
              type: 'string',
              description: 'Unique transaction ID'
            },
            upiId: {
              type: 'string',
              description: 'UPI ID for withdrawals'
            },
            gameRoom: {
              type: 'object',
              properties: {
                roomId: {
                  type: 'string',
                  description: 'Game room code'
                },
                gameType: {
                  type: 'string',
                  description: 'Game type'
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status'
            },
            message: {
              type: 'string',
              description: 'Response message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Validation failed'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Field name with error'
                  },
                  message: {
                    type: 'string',
                    description: 'Error message'
                  }
                }
              }
            }
          }
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {}
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'number',
                  description: 'Current page number'
                },
                limit: {
                  type: 'number',
                  description: 'Items per page'
                },
                total: {
                  type: 'number',
                  description: 'Total items'
                },
                pages: {
                  type: 'number',
                  description: 'Total pages'
                },
                hasNext: {
                  type: 'boolean',
                  description: 'Has next page'
                },
                hasPrev: {
                  type: 'boolean',
                  description: 'Has previous page'
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./server/routes/*.js', './server/controllers/*.js']
};

const specs = swaggerJsdoc(options);

export { specs, swaggerUi };
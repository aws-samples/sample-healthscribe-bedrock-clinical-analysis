// Shared utility functions for Lambda functions

const logger = {
  info: (message, data = {}) => {
    console.log(JSON.stringify({ level: 'INFO', message, ...data }));
  },
  error: (message, error = {}) => {
    console.error(JSON.stringify({ level: 'ERROR', message, error: error.message || error }));
  },
  debug: (message, data = {}) => {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.log(JSON.stringify({ level: 'DEBUG', message, ...data }));
    }
  }
};

const response = {
  success: (data = {}) => ({
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ success: true, ...data })
  }),
  
  error: (message, statusCode = 500) => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ success: false, error: message })
  })
};

module.exports = {
  logger,
  response
};

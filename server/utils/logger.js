const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'botbuilder-platform' },
  transports: [
    // Error log file - only errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),

    // Combined log file - all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),

    // Audit log file - audit events only
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Create separate logger for HTTP requests
const httpLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  httpLogger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Helper functions for different log levels
const log = {
  error: (message, meta = {}) => {
    logger.error(message, meta);
  },

  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },

  info: (message, meta = {}) => {
    logger.info(message, meta);
  },

  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },

  http: (message, meta = {}) => {
    httpLogger.info(message, meta);
  },

  // Audit specific logging
  audit: (action, data = {}) => {
    logger.info(`AUDIT: ${action}`, {
      type: 'audit',
      action,
      ...data,
    });
  },
};

module.exports = log;

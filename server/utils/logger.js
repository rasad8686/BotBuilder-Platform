/**
 * @fileoverview Winston Logger Configuration
 * @description Centralized logging service for the BotBuilder platform.
 * Provides structured logging with multiple transports (file, console).
 * @module utils/logger
 * @author BotBuilder Team
 */

const winston = require('winston');
const path = require('path');

/**
 * JSON log format with timestamp and error stack traces
 * @constant {Object}
 */
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

/**
 * Logger API object providing structured logging methods
 * @namespace log
 * @description Provides convenient logging methods for different log levels.
 * All methods accept a message string and optional metadata object.
 *
 * @example
 * const log = require('./utils/logger');
 *
 * log.info('User logged in', { userId: 123 });
 * log.error('Database connection failed', { error: err.message });
 * log.audit('bot.created', { botId: 1, userId: 123 });
 */
const log = {
  /**
   * Log an error message
   * @param {string} message - Error message to log
   * @param {Object} [meta={}] - Additional metadata
   * @returns {void}
   *
   * @example
   * log.error('Failed to process request', { requestId: 'abc123', error: err.message });
   */
  error: (message, meta = {}) => {
    logger.error(message, meta);
  },

  /**
   * Log a warning message
   * @param {string} message - Warning message to log
   * @param {Object} [meta={}] - Additional metadata
   * @returns {void}
   *
   * @example
   * log.warn('Rate limit approaching', { userId: 123, remaining: 5 });
   */
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },

  /**
   * Log an informational message
   * @param {string} message - Info message to log
   * @param {Object} [meta={}] - Additional metadata
   * @returns {void}
   *
   * @example
   * log.info('Bot created successfully', { botId: 1, name: 'Support Bot' });
   */
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },

  /**
   * Log a debug message (only in development)
   * @param {string} message - Debug message to log
   * @param {Object} [meta={}] - Additional metadata
   * @returns {void}
   *
   * @example
   * log.debug('Query executed', { sql: 'SELECT...', duration: 15 });
   */
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },

  /**
   * Log an HTTP request (separate log file)
   * @param {string} message - HTTP log message
   * @param {Object} [meta={}] - Request metadata
   * @returns {void}
   *
   * @example
   * log.http('GET /api/bots', { method: 'GET', path: '/api/bots', statusCode: 200 });
   */
  http: (message, meta = {}) => {
    httpLogger.info(message, meta);
  },

  /**
   * Log an audit event for compliance and tracking
   * @param {string} action - Action identifier (e.g., 'bot.created', 'user.login')
   * @param {Object} [data={}] - Audit data including userId, resourceId, etc.
   * @returns {void}
   *
   * @example
   * log.audit('bot.deleted', {
   *   userId: 123,
   *   botId: 456,
   *   organizationId: 789,
   *   ip: '192.168.1.1'
   * });
   */
  audit: (action, data = {}) => {
    logger.info(`AUDIT: ${action}`, {
      type: 'audit',
      action,
      ...data,
    });
  },
};

module.exports = log;

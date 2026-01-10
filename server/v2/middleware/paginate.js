/**
 * Cursor-based Pagination Middleware
 * Professional pagination with cursor support
 */

const { ErrorCodes, ApiError } = require('../constants/errorCodes');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function paginate(req, res, next) {
  // Parse limit
  let limit = parseInt(req.query.limit) || DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (limit < 1) limit = 1;

  // Parse cursor
  const cursor = req.query.cursor || null;

  // Parse offset (for offset-based pagination fallback)
  const offset = parseInt(req.query.offset) || 0;

  // Attach pagination params to request
  req.pagination = {
    limit,
    cursor,
    offset,
    // Helper to decode cursor
    decodeCursor: (cursor) => {
      if (!cursor) return null;
      try {
        return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      } catch {
        return null;
      }
    },
    // Helper to encode cursor
    encodeCursor: (data) => {
      return Buffer.from(JSON.stringify(data)).toString('base64');
    }
  };

  // Helper to set pagination meta
  res.paginate = function(items, options = {}) {
    const { total, hasMore, nextCursor, prevCursor } = options;

    req.paginationMeta = {
      limit,
      ...(total !== undefined && { total }),
      hasMore: hasMore !== undefined ? hasMore : items.length === limit,
      ...(nextCursor && { nextCursor }),
      ...(prevCursor && { prevCursor }),
      ...(cursor && { currentCursor: cursor })
    };

    return items;
  };

  next();
}

module.exports = paginate;

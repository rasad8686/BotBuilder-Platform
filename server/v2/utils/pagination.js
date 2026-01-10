/**
 * Pagination Utilities
 */

/**
 * Apply cursor-based pagination to a query
 * @param {Object} query - Knex query builder
 * @param {Object} options - Pagination options
 */
function applyCursorPagination(query, options) {
  const { cursor, limit, sortField = 'created_at', sortOrder = 'desc' } = options;

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      const operator = sortOrder === 'desc' ? '<' : '>';
      query.where(sortField, operator, decoded.value);
    }
  }

  query.orderBy(sortField, sortOrder);
  query.limit(limit + 1); // Get one extra to check if there's more

  return query;
}

/**
 * Process results for cursor pagination
 * @param {Array} items - Query results
 * @param {number} limit - Requested limit
 * @param {string} cursorField - Field to use for cursor
 */
function processCursorResults(items, limit, cursorField = 'id') {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;

  let nextCursor = null;
  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1];
    nextCursor = encodeCursor({
      value: lastItem[cursorField],
      field: cursorField
    });
  }

  return {
    data,
    hasMore,
    nextCursor
  };
}

/**
 * Encode cursor to base64
 */
function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decode cursor from base64
 */
function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Apply offset pagination (fallback)
 */
function applyOffsetPagination(query, options) {
  const { offset = 0, limit = 20 } = options;
  query.offset(offset).limit(limit);
  return query;
}

module.exports = {
  applyCursorPagination,
  processCursorResults,
  encodeCursor,
  decodeCursor,
  applyOffsetPagination
};

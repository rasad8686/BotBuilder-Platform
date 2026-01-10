/**
 * Query Builder Utilities
 * Helps build database queries with filtering and sorting
 */

/**
 * Apply filters to query
 * @param {Object} query - Knex query builder
 * @param {Object} filters - Filter object
 * @param {Object} allowedFilters - Map of allowed filter fields
 */
function applyFilters(query, filters, allowedFilters) {
  for (const [key, value] of Object.entries(filters)) {
    if (!allowedFilters[key] || value === undefined) continue;

    const config = allowedFilters[key];
    const column = config.column || key;

    switch (config.type) {
      case 'exact':
        query.where(column, value);
        break;
      case 'like':
        query.where(column, 'ilike', `%${value}%`);
        break;
      case 'in':
        query.whereIn(column, Array.isArray(value) ? value : [value]);
        break;
      case 'boolean':
        query.where(column, value === 'true' || value === true);
        break;
      case 'date_gte':
        query.where(column, '>=', value);
        break;
      case 'date_lte':
        query.where(column, '<=', value);
        break;
      case 'number_gte':
        query.where(column, '>=', parseFloat(value));
        break;
      case 'number_lte':
        query.where(column, '<=', parseFloat(value));
        break;
      default:
        query.where(column, value);
    }
  }

  return query;
}

/**
 * Apply sorting to query
 * @param {Object} query - Knex query builder
 * @param {string} sort - Sort string (e.g., "-created_at" or "name")
 * @param {Array} allowedFields - Allowed sort fields
 */
function applySort(query, sort, allowedFields = ['created_at']) {
  if (!sort) {
    query.orderBy('created_at', 'desc');
    return query;
  }

  const isDesc = sort.startsWith('-');
  const field = isDesc ? sort.slice(1) : sort;

  if (allowedFields.includes(field)) {
    query.orderBy(field, isDesc ? 'desc' : 'asc');
  } else {
    query.orderBy('created_at', 'desc');
  }

  return query;
}

/**
 * Apply search to query
 * @param {Object} query - Knex query builder
 * @param {string} search - Search term
 * @param {Array} searchFields - Fields to search in
 */
function applySearch(query, search, searchFields) {
  if (!search || !searchFields.length) return query;

  query.where(function() {
    for (const field of searchFields) {
      this.orWhere(field, 'ilike', `%${search}%`);
    }
  });

  return query;
}

module.exports = {
  applyFilters,
  applySort,
  applySearch
};

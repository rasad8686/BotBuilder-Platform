/**
 * Response Envelope Middleware
 * Wraps all responses in consistent format
 */

const { ApiError } = require('../constants/errorCodes');

function responseEnvelope(req, res, next) {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method
  res.json = function(data) {
    // If already wrapped, send as is
    if (data && data._wrapped) {
      delete data._wrapped;
      return originalJson(data);
    }

    // If it's an error response
    if (data instanceof ApiError || (data && data.code && data.status)) {
      return originalJson({
        success: false,
        error: {
          code: data.code,
          message: data.message,
          ...(data.details && { details: data.details })
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: 'v2'
        }
      });
    }

    // Standard success response
    const response = {
      success: true,
      data: data,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: 'v2'
      }
    };

    // Add pagination meta if exists
    if (req.paginationMeta) {
      response.meta.pagination = req.paginationMeta;
    }

    // Add links if exists
    if (req.hateoasLinks) {
      response.links = req.hateoasLinks;
    }

    return originalJson(response);
  };

  // Success helper
  res.success = function(data, statusCode = 200) {
    res.status(statusCode);
    return res.json(data);
  };

  // Created helper
  res.created = function(data) {
    return res.success(data, 201);
  };

  // No content helper
  res.noContent = function() {
    return res.status(204).send();
  };

  // Error helper
  res.apiError = function(errorCode, details = null) {
    const error = new ApiError(errorCode, details);
    res.status(error.status);
    return res.json(error);
  };

  next();
}

module.exports = responseEnvelope;

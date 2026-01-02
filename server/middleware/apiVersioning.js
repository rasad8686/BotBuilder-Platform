/**
 * API Versioning Middleware
 * Supports header-based and URL-based versioning
 * Features:
 * - Accept-Version header support
 * - URL path versioning (/api/v1/, /api/v2/)
 * - Default version fallback
 * - Deprecation warnings
 * - Sunset headers
 */

const apiVersions = require('../config/apiVersions');
const logger = require('../utils/logger');

/**
 * Extract version from request
 * Priority: URL path > Accept-Version header > Default
 * @param {Object} req - Express request
 * @returns {string} API version
 */
const extractVersion = (req) => {
  // 1. Check URL path for version (e.g., /api/v2/bots)
  const urlMatch = req.path.match(/^\/api\/(v\d+)\//);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // 2. Check Accept-Version header
  const headerVersion = req.headers['accept-version'];
  if (headerVersion) {
    // Normalize header value (accept "v1", "v2", "1", "2")
    const normalized = headerVersion.toLowerCase().startsWith('v')
      ? headerVersion.toLowerCase()
      : `v${headerVersion}`;
    return normalized;
  }

  // 3. Check X-API-Version header (alternative)
  const xApiVersion = req.headers['x-api-version'];
  if (xApiVersion) {
    const normalized = xApiVersion.toLowerCase().startsWith('v')
      ? xApiVersion.toLowerCase()
      : `v${xApiVersion}`;
    return normalized;
  }

  // 4. Return default version
  return apiVersions.default;
};

/**
 * Validate version is supported
 * @param {string} version - Version to validate
 * @returns {boolean} Whether version is supported
 */
const isVersionSupported = (version) => {
  return apiVersions.supported.includes(version);
};

/**
 * Get version configuration
 * @param {string} version - Version string
 * @returns {Object|null} Version config or null
 */
const getVersionConfig = (version) => {
  return apiVersions.versions[version] || null;
};

/**
 * API Versioning Middleware
 * Extracts version from request and adds version info to response headers
 */
const apiVersioning = (options = {}) => {
  const {
    strictMode = false, // If true, reject unsupported versions
    addHeaders = true   // Add version headers to response
  } = options;

  return (req, res, next) => {
    // Extract version from request
    const requestedVersion = extractVersion(req);

    // Validate version
    if (!isVersionSupported(requestedVersion)) {
      if (strictMode) {
        return res.status(400).json({
          success: false,
          error: `API version '${requestedVersion}' is not supported`,
          supported_versions: apiVersions.supported,
          default_version: apiVersions.default
        });
      }
      // Fall back to default version
      req.apiVersion = apiVersions.default;
      logger.warn(`Unsupported API version requested: ${requestedVersion}, using default: ${apiVersions.default}`);
    } else {
      req.apiVersion = requestedVersion;
    }

    // Get version config
    const versionConfig = getVersionConfig(req.apiVersion);

    // Store version info in request for route handlers
    req.apiVersionConfig = versionConfig;

    // Add response headers
    if (addHeaders) {
      res.setHeader('X-API-Version', req.apiVersion);

      if (versionConfig) {
        // Add deprecation warning header
        if (versionConfig.deprecated) {
          res.setHeader('X-API-Deprecated', 'true');
          res.setHeader('Deprecation', 'true');

          // Add sunset header if specified
          if (versionConfig.sunset) {
            res.setHeader('X-API-Sunset', versionConfig.sunset);
            res.setHeader('Sunset', new Date(versionConfig.sunset).toUTCString());
          }

          // Add deprecation warning to response
          res.on('finish', () => {
            logger.warn(`Deprecated API version ${req.apiVersion} used for ${req.method} ${req.path}`);
          });
        } else {
          res.setHeader('X-API-Deprecated', 'false');
        }

        // Add version status header
        res.setHeader('X-API-Version-Status', versionConfig.status);
      }
    }

    next();
  };
};

/**
 * Version check middleware for specific version requirements
 * Use this to protect routes that require a minimum version
 * @param {string} minVersion - Minimum required version
 */
const requireVersion = (minVersion) => {
  return (req, res, next) => {
    const currentVersion = req.apiVersion || apiVersions.default;
    const currentNum = parseInt(currentVersion.replace('v', ''));
    const minNum = parseInt(minVersion.replace('v', ''));

    if (currentNum < minNum) {
      return res.status(400).json({
        success: false,
        error: `This endpoint requires API version ${minVersion} or higher`,
        current_version: currentVersion,
        required_version: minVersion
      });
    }

    next();
  };
};

/**
 * Version deprecation warning middleware
 * Adds warning when using deprecated endpoints
 * @param {string} message - Custom deprecation message
 * @param {string} alternative - Alternative endpoint/method
 */
const deprecatedEndpoint = (message, alternative) => {
  return (req, res, next) => {
    res.setHeader('Warning', `299 - "Deprecated: ${message}"`);
    if (alternative) {
      res.setHeader('X-API-Alternative', alternative);
    }
    next();
  };
};

/**
 * Transform response based on API version
 * Use this to maintain backwards compatibility
 * @param {Object} transforms - Version-specific transform functions
 */
const versionedResponse = (transforms) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      const version = req.apiVersion || apiVersions.default;
      const transform = transforms[version];

      if (transform && typeof transform === 'function') {
        data = transform(data);
      }

      return originalJson(data);
    };

    next();
  };
};

module.exports = {
  apiVersioning,
  requireVersion,
  deprecatedEndpoint,
  versionedResponse,
  extractVersion,
  isVersionSupported,
  getVersionConfig
};

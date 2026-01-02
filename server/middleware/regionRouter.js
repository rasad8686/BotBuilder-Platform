const regionsConfig = require('../config/regions');
const log = require('../utils/logger');

/**
 * Region routing middleware
 * Handles X-Region header and routes requests appropriately
 */
const regionRouter = (req, res, next) => {
  try {
    // Get region from header or use default
    const requestedRegion = req.headers['x-region'] || regionsConfig.default;

    // Validate region
    const regionConfig = regionsConfig.regions[requestedRegion];

    if (!regionConfig) {
      // Invalid region, use default
      req.region = regionsConfig.default;
      req.regionConfig = regionsConfig.regions[regionsConfig.default];
    } else if (regionConfig.status !== 'active') {
      // Region not active, use default
      req.region = regionsConfig.default;
      req.regionConfig = regionsConfig.regions[regionsConfig.default];
      res.setHeader('X-Region-Fallback', 'true');
      res.setHeader('X-Region-Requested', requestedRegion);
    } else {
      req.region = requestedRegion;
      req.regionConfig = regionConfig;
    }

    // Set response headers
    res.setHeader('X-Region', req.region);
    res.setHeader('X-Region-Endpoint', req.regionConfig.endpoint);

    next();
  } catch (error) {
    log.error('Region router error', { error: error.message });
    // Don't block request, use default region
    req.region = regionsConfig.default;
    req.regionConfig = regionsConfig.regions[regionsConfig.default];
    next();
  }
};

/**
 * Latency-based routing middleware
 * Determines best region based on client location
 */
const latencyRouter = (req, res, next) => {
  try {
    // Get client IP or region hint
    const clientIP = req.headers['x-forwarded-for'] || req.ip;
    const cfCountry = req.headers['cf-ipcountry']; // Cloudflare country header

    let recommendedRegion = regionsConfig.default;

    if (cfCountry) {
      // Map country to region
      const countryToRegion = {
        // North America
        'US': 'us-east-1',
        'CA': 'us-east-1',
        'MX': 'us-east-1',

        // Europe
        'GB': 'eu-west-1',
        'DE': 'eu-west-1',
        'FR': 'eu-west-1',
        'IT': 'eu-west-1',
        'ES': 'eu-west-1',
        'NL': 'eu-west-1',
        'BE': 'eu-west-1',
        'AT': 'eu-west-1',
        'CH': 'eu-west-1',
        'PL': 'eu-west-1',
        'SE': 'eu-west-1',
        'NO': 'eu-west-1',
        'DK': 'eu-west-1',
        'FI': 'eu-west-1',
        'IE': 'eu-west-1',
        'PT': 'eu-west-1',

        // Asia Pacific
        'JP': 'ap-southeast-1',
        'KR': 'ap-southeast-1',
        'CN': 'ap-southeast-1',
        'TW': 'ap-southeast-1',
        'HK': 'ap-southeast-1',
        'SG': 'ap-southeast-1',
        'MY': 'ap-southeast-1',
        'TH': 'ap-southeast-1',
        'ID': 'ap-southeast-1',
        'PH': 'ap-southeast-1',
        'VN': 'ap-southeast-1',
        'IN': 'ap-southeast-1',
        'AU': 'ap-southeast-1',
        'NZ': 'ap-southeast-1'
      };

      recommendedRegion = countryToRegion[cfCountry] || regionsConfig.default;

      // Check if recommended region is active
      if (regionsConfig.regions[recommendedRegion]?.status !== 'active') {
        recommendedRegion = regionsConfig.default;
      }
    }

    req.recommendedRegion = recommendedRegion;
    res.setHeader('X-Recommended-Region', recommendedRegion);

    next();
  } catch (error) {
    log.error('Latency router error', { error: error.message });
    req.recommendedRegion = regionsConfig.default;
    next();
  }
};

/**
 * Validate region access for organization
 */
const validateRegionAccess = async (req, res, next) => {
  try {
    const db = require('../db');
    const requestedRegion = req.body?.region || req.query?.region;

    if (!requestedRegion) {
      return next();
    }

    // Get user's organization allowed regions
    if (req.user?.id) {
      const result = await db.query(
        `SELECT o.allowed_regions
         FROM organizations o
         JOIN organization_members om ON om.org_id = o.id
         WHERE om.user_id = $1 AND om.status = 'active'
         LIMIT 1`,
        [req.user.id]
      );

      if (result.rows.length > 0) {
        const allowedRegions = result.rows[0].allowed_regions || [regionsConfig.default];

        if (!allowedRegions.includes(requestedRegion)) {
          return res.status(403).json({
            success: false,
            message: `Region '${requestedRegion}' is not allowed for your organization`
          });
        }
      }
    }

    next();
  } catch (error) {
    log.error('Validate region access error', { error: error.message });
    next();
  }
};

module.exports = {
  regionRouter,
  latencyRouter,
  validateRegionAccess
};

/**
 * Custom Domain Router Middleware
 * Routes requests based on Host header to correct widget/API/portal
 */

const db = require('../db');
const log = require('../utils/logger');

// Cache for domain lookups (5 minute TTL)
const domainCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear expired cache entries
 */
function clearExpiredCache() {
  const now = Date.now();
  for (const [key, value] of domainCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      domainCache.delete(key);
    }
  }
}

// Run cache cleanup every minute
setInterval(clearExpiredCache, 60 * 1000);

/**
 * Get domain info from cache or database
 * @param {string} host - Host header value
 * @returns {object|null} Domain configuration
 */
async function getDomainConfig(host) {
  // Remove port if present
  const domain = host.split(':')[0].toLowerCase();

  // Check cache
  const cached = domainCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Lookup in database
  try {
    const result = await db.query(
      `SELECT cd.*, o.id as org_id, o.slug as org_slug, o.settings as org_settings
       FROM custom_domains cd
       JOIN organizations o ON cd.organization_id = o.id
       WHERE cd.domain = $1 AND cd.status = 'active'`,
      [domain]
    );

    const data = result.rows.length > 0 ? result.rows[0] : null;

    // Cache the result
    domainCache.set(domain, {
      data,
      timestamp: Date.now()
    });

    return data;
  } catch (error) {
    log.error('Error looking up custom domain:', error);
    return null;
  }
}

/**
 * Custom Domain Router Middleware
 * Attaches domain configuration to request for downstream handlers
 */
async function customDomainRouter(req, res, next) {
  const host = req.headers.host || req.hostname;

  // Skip for localhost and main domain
  if (host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('botbuilder.com') ||
      host.includes('botbuilder.io')) {
    return next();
  }

  try {
    const domainConfig = await getDomainConfig(host);

    if (domainConfig) {
      // Attach domain info to request
      req.customDomain = {
        id: domainConfig.id,
        domain: domainConfig.domain,
        type: domainConfig.type,
        organizationId: domainConfig.org_id,
        organizationSlug: domainConfig.org_slug,
        settings: domainConfig.settings || {},
        sslStatus: domainConfig.ssl_status
      };

      // Set organization context for API requests
      if (domainConfig.type === 'api') {
        req.headers['x-organization-id'] = domainConfig.org_id.toString();
      }

      log.debug('Custom domain matched', {
        domain: host,
        type: domainConfig.type,
        orgId: domainConfig.org_id
      });
    }
  } catch (error) {
    log.error('Custom domain router error:', error);
  }

  next();
}

/**
 * Widget Domain Handler
 * Serves widget for custom widget domains
 */
function widgetDomainHandler(req, res, next) {
  if (req.customDomain && req.customDomain.type === 'widget') {
    // Serve widget configuration
    if (req.path === '/' || req.path === '/widget.js') {
      return res.redirect(`/api/widget/embed/${req.customDomain.organizationId}`);
    }
  }
  next();
}

/**
 * API Domain Handler
 * Routes API requests for custom API domains
 */
function apiDomainHandler(req, res, next) {
  if (req.customDomain && req.customDomain.type === 'api') {
    // API requests should have organization context automatically set
    // The organization context middleware will pick up x-organization-id header
    log.debug('API request via custom domain', {
      domain: req.customDomain.domain,
      path: req.path
    });
  }
  next();
}

/**
 * Portal Domain Handler
 * Handles custom portal domains for white-label
 */
function portalDomainHandler(req, res, next) {
  if (req.customDomain && req.customDomain.type === 'portal') {
    // Set branding context for white-label portal
    req.whiteLabelOrg = req.customDomain.organizationId;
    req.whiteLabelSettings = req.customDomain.settings;
  }
  next();
}

/**
 * Invalidate cache for a specific domain
 * @param {string} domain - Domain to invalidate
 */
function invalidateCache(domain) {
  domainCache.delete(domain.toLowerCase());
}

/**
 * Clear entire domain cache
 */
function clearCache() {
  domainCache.clear();
}

module.exports = {
  customDomainRouter,
  widgetDomainHandler,
  apiDomainHandler,
  portalDomainHandler,
  getDomainConfig,
  invalidateCache,
  clearCache
};

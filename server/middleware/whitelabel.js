const db = require('../db');

/**
 * Domain Detection Middleware
 * Detects custom domains and loads whitelabel settings
 * Attaches branding data to req.whitelabel
 */

async function detectCustomDomain(req, res, next) {
  try {
    const hostname = req.hostname || req.get('host');

    // Skip for localhost and default domains
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      req.whitelabel = null;
      return next();
    }

    // Check if this hostname is a custom domain
    const query = `
      SELECT
        ws.*,
        o.id as org_id,
        o.name as org_name
      FROM whitelabel_settings ws
      JOIN organizations o ON ws.organization_id = o.id
      WHERE ws.custom_domain = $1 AND ws.custom_domain_verified = true
    `;

    const result = await db.query(query, [hostname]);

    if (result.rows.length > 0) {
      req.whitelabel = result.rows[0];
      console.log(`[Whitelabel] Custom domain detected: ${hostname} -> Org: ${req.whitelabel.org_name}`);
    } else {
      req.whitelabel = null;
    }

    next();
  } catch (error) {
    console.error('Domain detection error:', error);
    req.whitelabel = null;
    next();
  }
}

module.exports = {
  detectCustomDomain
};

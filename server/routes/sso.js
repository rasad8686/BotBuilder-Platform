/**
 * SSO Routes
 * Enterprise Single Sign-On API endpoints
 */

const express = require('express');
const router = express.Router();
const log = require('../utils/logger');
const SSOService = require('../services/ssoService');
const SAMLService = require('../services/samlService');
const OIDCService = require('../services/oidcService');
const SCIMService = require('../services/scimService');
const SSOGroupService = require('../services/ssoGroupService');
const SSOAnalyticsService = require('../services/ssoAnalyticsService');
const authenticateToken = require('../middleware/auth');
const db = require('../db');
const jwt = require('jsonwebtoken');

// Store for SSO session state (in production, use Redis)
const ssoStateStore = new Map();

// Cleanup old states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of ssoStateStore.entries()) {
    if (now - value.timestamp > 10 * 60 * 1000) {
      ssoStateStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Helper function to verify config ownership
async function verifyConfigOwnership(configId, orgId) {
  const result = await db.query(
    'SELECT * FROM sso_configurations WHERE id = $1 AND organization_id = $2',
    [configId, orgId]
  );
  return result.rows[0] || null;
}

// ==================== CONFIG ENDPOINTS ====================

// GET /api/sso/config - Get organization SSO configuration
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user.current_organization_id || req.user.organization_id;

    if (!orgId) {
      return res.json({ config: null });
    }

    const config = await SSOService.getSSOConfigByOrg(orgId);

    res.json({ config });
  } catch (error) {
    if (error.message && (error.message.includes('does not exist') || error.message.includes('no such table'))) {
      log.warn('SSO tables not found - migration may not have been run');
      return res.json({ config: null });
    }
    log.error('Error getting SSO config:', { error: error.message });
    res.status(500).json({ error: 'Failed to get SSO configuration' });
  }
});

// POST /api/sso/config - Create SSO configuration
router.post('/config', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user.current_organization_id || req.user.organization_id;

    // Check if user has permission (org admin)
    const memberResult = await db.query(
      'SELECT * FROM team_members WHERE user_id = $1 AND tenant_id = $2',
      [req.user.id, orgId]
    );
    const member = memberResult.rows[0];

    if (!member || member.role_id !== 1) {
      const orgResult = await db.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
      const org = orgResult.rows[0];
      if (!org || org.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Only organization admins can configure SSO' });
      }
    }

    const config = await SSOService.createSSOConfig(orgId, req.body);

    res.status(201).json({ config });
  } catch (error) {
    log.error('Error creating SSO config:', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to create SSO configuration' });
  }
});

// PUT /api/sso/config/:id - Update SSO configuration
router.put('/config/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const existing = await verifyConfigOwnership(id, orgId);
    if (!existing) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const config = await SSOService.updateSSOConfig(id, req.body);

    res.json({ config });
  } catch (error) {
    log.error('Error updating SSO config:', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to update SSO configuration' });
  }
});

// DELETE /api/sso/config/:id - Delete SSO configuration
router.delete('/config/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const existing = await verifyConfigOwnership(id, orgId);
    if (!existing) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    await SSOService.deleteSSOConfig(id);

    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting SSO config:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete SSO configuration' });
  }
});

// POST /api/sso/config/:id/test - Test SSO connection
router.post('/config/:id/test', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const existing = await verifyConfigOwnership(id, orgId);
    if (!existing) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const results = await SSOService.testSSOConnection(id);

    res.json(results);
  } catch (error) {
    log.error('Error testing SSO connection:', { error: error.message });
    res.status(500).json({ error: 'Failed to test SSO connection' });
  }
});

// GET /api/sso/config/:id/metadata - Get SAML SP Metadata
router.get('/config/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params;

    const metadata = await SSOService.generateSAMLMetadata(id);

    res.set('Content-Type', 'application/xml');
    res.send(metadata);
  } catch (error) {
    log.error('Error generating SAML metadata:', { error: error.message });
    res.status(500).json({ error: 'Failed to generate metadata' });
  }
});

// GET /api/sso/config/:id/logs - Get SSO login logs
router.get('/config/:id/logs', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const existing = await verifyConfigOwnership(id, orgId);
    if (!existing) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const logs = await SSOService.getLoginLogs(id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json(logs);
  } catch (error) {
    log.error('Error getting SSO logs:', { error: error.message });
    res.status(500).json({ error: 'Failed to get login logs' });
  }
});

// ==================== DOMAIN ENDPOINTS ====================

// POST /api/sso/domains - Add domain to SSO configuration
router.post('/domains', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user.current_organization_id || req.user.organization_id;
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const configResult = await db.query(
      'SELECT * FROM sso_configurations WHERE organization_id = $1',
      [orgId]
    );
    const config = configResult.rows[0];

    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found. Create SSO config first.' });
    }

    const ssoDomain = await SSOService.addDomain(config.id, domain);

    res.status(201).json({
      domain: ssoDomain,
      verification: {
        instructions: `Add a TXT record to your DNS:`,
        recordType: 'TXT',
        hostname: `_sso-verify.${domain}`,
        value: ssoDomain.verification_token
      }
    });
  } catch (error) {
    log.error('Error adding SSO domain:', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to add domain' });
  }
});

// POST /api/sso/domains/:id/verify - Verify domain ownership
router.post('/domains/:id/verify', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const configResult = await db.query(
      'SELECT * FROM sso_configurations WHERE organization_id = $1',
      [orgId]
    );
    const config = configResult.rows[0];

    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const result = await SSOService.verifySSODomain(config.id, parseInt(id));

    res.json(result);
  } catch (error) {
    log.error('Error verifying SSO domain:', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to verify domain' });
  }
});

// DELETE /api/sso/domains/:id - Delete domain
router.delete('/domains/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const configResult = await db.query(
      'SELECT * FROM sso_configurations WHERE organization_id = $1',
      [orgId]
    );
    const config = configResult.rows[0];

    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    await SSOService.deleteDomain(config.id, parseInt(id));

    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting SSO domain:', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to delete domain' });
  }
});

// ==================== SSO AUTH ENDPOINTS ====================

// GET /api/sso/check - Check if email requires SSO
router.get('/check', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await SSOService.checkEmailSSO(email);

    res.json(result);
  } catch (error) {
    log.error('Error checking SSO for email:', { error: error.message });
    res.status(500).json({ error: 'Failed to check SSO status' });
  }
});

// GET /api/sso/login/:domain - Initiate SSO login
router.get('/login/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const { returnUrl } = req.query;

    const config = await SSOService.getSSOConfigByDomain(domain);

    if (!config) {
      return res.status(404).json({ error: 'SSO not configured for this domain' });
    }

    if (!config.is_enabled) {
      return res.status(400).json({ error: 'SSO is not enabled' });
    }

    const state = require('crypto').randomBytes(16).toString('hex');

    ssoStateStore.set(state, {
      configId: config.id,
      returnUrl: returnUrl || '/',
      timestamp: Date.now()
    });

    let authUrl;

    if (config.provider_type === 'saml' || config.provider_type === 'azure_ad' || config.provider_type === 'okta') {
      const result = await SAMLService.generateAuthRequest(config.id, state);
      authUrl = result.url;
    } else {
      const result = await OIDCService.generateAuthorizationUrl(config.id, state);
      authUrl = result.url;

      ssoStateStore.set(state, {
        ...ssoStateStore.get(state),
        nonce: result.nonce,
        codeVerifier: result.codeVerifier
      });
    }

    await SSOService.logLoginAttempt({
      configId: config.id,
      email: null,
      status: 'pending',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ authUrl, state });
  } catch (error) {
    log.error('Error initiating SSO login:', { error: error.message });
    res.status(500).json({ error: 'Failed to initiate SSO login' });
  }
});

// POST /api/sso/saml/acs - SAML Assertion Consumer Service
router.post('/saml/acs', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { SAMLResponse, RelayState } = req.body;

    if (!SAMLResponse) {
      return res.status(400).json({ error: 'SAMLResponse is required' });
    }

    const stateData = ssoStateStore.get(RelayState);
    if (!stateData) {
      return res.status(400).json({ error: 'Invalid or expired state' });
    }

    const { configId, returnUrl } = stateData;

    const result = await SAMLService.parseAssertion(SAMLResponse, configId);

    if (!result.success) {
      await SSOService.logLoginAttempt({
        configId,
        email: result.user?.email,
        status: 'failed',
        errorMessage: 'SAML assertion validation failed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      return res.status(401).json({ error: 'SAML authentication failed' });
    }

    const user = await processSSoUser(configId, result.user, req);

    ssoStateStore.delete(RelayState);

    await SSOService.logLoginAttempt({
      configId,
      userId: user.id,
      email: result.user.email,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    const token = generateUserToken(user);

    const baseUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3001';
    res.redirect(`${baseUrl}/sso/callback?token=${token}&returnUrl=${encodeURIComponent(returnUrl)}`);
  } catch (error) {
    log.error('Error in SAML ACS:', { error: error.message });
    const baseUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3001';
    res.redirect(`${baseUrl}/login?error=sso_failed&message=${encodeURIComponent(error.message)}`);
  }
});

// GET /api/sso/oidc/authorize - Initiate OIDC login
router.get('/oidc/authorize', async (req, res) => {
  try {
    const { configId, domain, loginHint, prompt } = req.query;

    let config;

    if (configId) {
      config = await SSOService.getFullConfig(parseInt(configId));
    } else if (domain) {
      config = await SSOService.getSSOConfigByDomain(domain);
    } else {
      return res.status(400).json({ error: 'Configuration ID or domain required' });
    }

    if (!config || !config.is_enabled) {
      return res.status(404).json({ error: 'SSO configuration not found or disabled' });
    }

    const state = require('crypto').randomBytes(16).toString('hex');
    const nonce = require('crypto').randomBytes(16).toString('hex');
    const codeVerifier = OIDCService.generateCodeVerifier();
    const codeChallenge = OIDCService.generateCodeChallenge(codeVerifier);

    ssoStateStore.set(state, {
      configId: config.id,
      nonce,
      codeVerifier,
      returnUrl: req.query.returnUrl || '/',
      timestamp: Date.now()
    });

    const authUrl = OIDCService.buildAuthorizationUrl(
      config,
      state,
      nonce,
      codeChallenge,
      { loginHint, prompt }
    );

    log.info('OIDC authorization initiated', { configId: config.id, state });

    res.redirect(authUrl);
  } catch (error) {
    log.error('Error initiating OIDC authorization:', { error: error.message });
    const baseUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3001';
    res.redirect(`${baseUrl}/login?error=sso_init_failed&message=${encodeURIComponent(error.message)}`);
  }
});

// POST /api/sso/oidc/refresh - Refresh OIDC tokens
router.post('/oidc/refresh', authenticateToken, async (req, res) => {
  try {
    const { configId } = req.body;
    const userId = req.user.id;

    if (!configId) {
      return res.status(400).json({ error: 'Configuration ID required' });
    }

    const mappingResult = await db.query(
      'SELECT * FROM sso_user_mappings WHERE sso_configuration_id = $1 AND user_id = $2',
      [configId, userId]
    );
    const mapping = mappingResult.rows[0];

    if (!mapping?.attributes) {
      return res.status(400).json({ error: 'No SSO session found' });
    }

    const attributes = typeof mapping.attributes === 'string'
      ? JSON.parse(mapping.attributes)
      : mapping.attributes;

    if (!attributes.refresh_token_encrypted) {
      return res.status(400).json({ error: 'No refresh token available' });
    }

    const EncryptionHelper = require('../services/ai/encryptionHelper');
    const refreshToken = EncryptionHelper.decrypt(attributes.refresh_token_encrypted);

    const newTokens = await OIDCService.refreshTokens(refreshToken, configId);

    if (newTokens.refresh_token) {
      const newEncrypted = EncryptionHelper.encrypt(newTokens.refresh_token);
      const updatedAttributes = { ...attributes, refresh_token_encrypted: newEncrypted };
      await db.query(
        'UPDATE sso_user_mappings SET attributes = $1 WHERE sso_configuration_id = $2 AND user_id = $3',
        [JSON.stringify(updatedAttributes), configId, userId]
      );
    }

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    const token = generateUserToken(user);

    res.json({
      success: true,
      token,
      expires_in: newTokens.expires_in
    });
  } catch (error) {
    log.error('Error refreshing OIDC tokens:', { error: error.message });
    res.status(500).json({ error: 'Failed to refresh tokens' });
  }
});

// GET /api/sso/oidc/userinfo - Get user info from IdP
router.get('/oidc/userinfo', authenticateToken, async (req, res) => {
  try {
    const { configId } = req.query;
    const userId = req.user.id;

    if (!configId) {
      return res.status(400).json({ error: 'Configuration ID required' });
    }

    const mappingResult = await db.query(
      'SELECT * FROM sso_user_mappings WHERE sso_configuration_id = $1 AND user_id = $2',
      [parseInt(configId), userId]
    );
    const mapping = mappingResult.rows[0];

    if (!mapping?.attributes) {
      return res.status(400).json({ error: 'No SSO session found' });
    }

    const attributes = typeof mapping.attributes === 'string'
      ? JSON.parse(mapping.attributes)
      : mapping.attributes;

    if (!attributes.access_token_encrypted) {
      return res.status(400).json({ error: 'No access token available' });
    }

    const EncryptionHelper = require('../services/ai/encryptionHelper');
    const accessToken = EncryptionHelper.decrypt(attributes.access_token_encrypted);

    const userInfo = await OIDCService.getUserInfo(accessToken, parseInt(configId));

    res.json({ userInfo });
  } catch (error) {
    log.error('Error getting userinfo:', { error: error.message });
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// POST /api/sso/oidc/discover - Auto-discover OIDC configuration
router.post('/oidc/discover', authenticateToken, async (req, res) => {
  try {
    const { issuerUrl } = req.body;

    if (!issuerUrl) {
      return res.status(400).json({ error: 'Issuer URL required' });
    }

    const discovery = await OIDCService.discoverConfiguration(issuerUrl);

    res.json({ discovery });
  } catch (error) {
    log.error('Error discovering OIDC configuration:', { error: error.message });
    res.status(500).json({ error: 'Failed to discover configuration: ' + error.message });
  }
});

// GET /api/sso/check-domain - Check if domain has SSO configured
router.get('/check-domain', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const domain = email.split('@')[1];
    if (!domain) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const config = await SSOService.getSSOConfigByDomain(domain);

    if (config && config.is_enabled) {
      res.json({
        ssoRequired: config.is_enforced,
        ssoAvailable: true,
        provider: config.provider_type,
        providerName: config.name,
        configId: config.id
      });
    } else {
      res.json({
        ssoRequired: false,
        ssoAvailable: false
      });
    }
  } catch (error) {
    log.error('Error checking domain SSO:', { error: error.message });
    res.status(500).json({ error: 'Failed to check domain' });
  }
});

// GET /api/sso/oidc/callback - OIDC callback
router.get('/oidc/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      log.error('OIDC error:', { error, error_description });
      const baseUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3001';
      return res.redirect(`${baseUrl}/login?error=sso_failed&message=${encodeURIComponent(error_description || error)}`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const stateData = ssoStateStore.get(state);
    if (!stateData) {
      return res.status(400).json({ error: 'Invalid or expired state' });
    }

    const { configId, returnUrl, nonce, codeVerifier } = stateData;

    const tokens = await OIDCService.exchangeCodeForTokens(configId, code, codeVerifier);

    const claims = await OIDCService.validateIdToken(tokens.id_token, configId, nonce);

    let userInfo = {};
    try {
      userInfo = await OIDCService.getUserInfo(tokens.access_token, configId) || {};
    } catch (e) {
      log.warn('Could not fetch userinfo:', { error: e.message });
    }

    const userAttributes = OIDCService.extractUserAttributes(claims, userInfo);

    const user = await processSSoUser(configId, userAttributes, req);

    ssoStateStore.delete(state);

    await SSOService.logLoginAttempt({
      configId,
      userId: user.id,
      email: userAttributes.email,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    const token = generateUserToken(user);

    const baseUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3001';
    res.redirect(`${baseUrl}/sso/callback?token=${token}&returnUrl=${encodeURIComponent(returnUrl)}`);
  } catch (error) {
    log.error('Error in OIDC callback:', { error: error.message });
    const baseUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3001';
    res.redirect(`${baseUrl}/login?error=sso_failed&message=${encodeURIComponent(error.message)}`);
  }
});

// POST /api/sso/logout - SSO logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const mappingResult = await db.query(
      'SELECT * FROM sso_user_mappings WHERE user_id = $1',
      [userId]
    );
    const mapping = mappingResult.rows[0];

    if (!mapping) {
      return res.json({ success: true, message: 'No SSO session to terminate' });
    }

    const config = await SSOService.getFullConfig(mapping.sso_configuration_id);

    if (!config) {
      return res.json({ success: true });
    }

    let logoutUrl = null;

    if (config.provider_type === 'saml' || config.provider_type === 'azure_ad' || config.provider_type === 'okta') {
      const result = await SAMLService.generateLogoutRequest(
        config.id,
        mapping.external_id,
        null
      );
      logoutUrl = result?.url;
    } else {
      logoutUrl = await OIDCService.getEndSessionUrl(config.id);
    }

    res.json({ success: true, logoutUrl });
  } catch (error) {
    log.error('Error in SSO logout:', { error: error.message });
    res.status(500).json({ error: 'Failed to logout from SSO' });
  }
});

// ==================== SCIM TOKEN ENDPOINTS ====================

// POST /api/sso/config/:id/scim/tokens - Generate SCIM token
router.post('/config/:id/scim/tokens', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, expiresInDays } = req.body;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const result = await SCIMService.generateToken(id, name || 'SCIM Token', expiresInDays);

    res.status(201).json(result);
  } catch (error) {
    log.error('Error generating SCIM token:', { error: error.message });
    res.status(500).json({ error: 'Failed to generate SCIM token' });
  }
});

// GET /api/sso/config/:id/scim/tokens - List SCIM tokens
router.get('/config/:id/scim/tokens', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const tokensResult = await db.query(
      'SELECT id, name, token_prefix, is_active, last_used_at, expires_at, created_at FROM scim_tokens WHERE sso_configuration_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({ tokens: tokensResult.rows });
  } catch (error) {
    log.error('Error listing SCIM tokens:', { error: error.message });
    res.status(500).json({ error: 'Failed to list SCIM tokens' });
  }
});

// DELETE /api/sso/config/:id/scim/tokens/:tokenId - Revoke SCIM token
router.delete('/config/:id/scim/tokens/:tokenId', authenticateToken, async (req, res) => {
  try {
    const { id, tokenId } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    await db.query(
      'UPDATE scim_tokens SET is_active = false WHERE id = $1 AND sso_configuration_id = $2',
      [tokenId, id]
    );

    res.json({ success: true });
  } catch (error) {
    log.error('Error revoking SCIM token:', { error: error.message });
    res.status(500).json({ error: 'Failed to revoke SCIM token' });
  }
});

// ==================== GROUP MAPPING ENDPOINTS ====================

// GET /api/sso/config/:id/groups - Get group mappings
router.get('/config/:id/groups', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const mappings = await SSOGroupService.getMappings(id);

    res.json({ mappings });
  } catch (error) {
    log.error('Error getting group mappings:', { error: error.message });
    res.status(500).json({ error: 'Failed to get group mappings' });
  }
});

// POST /api/sso/config/:id/groups - Create group mapping
router.post('/config/:id/groups', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const mapping = await SSOGroupService.createMapping(id, req.body);

    res.status(201).json({ mapping });
  } catch (error) {
    log.error('Error creating group mapping:', { error: error.message });
    res.status(500).json({ error: 'Failed to create group mapping' });
  }
});

// PUT /api/sso/config/:id/groups/:mappingId - Update group mapping
router.put('/config/:id/groups/:mappingId', authenticateToken, async (req, res) => {
  try {
    const { id, mappingId } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const mapping = await SSOGroupService.updateMapping(id, mappingId, req.body);

    res.json({ mapping });
  } catch (error) {
    log.error('Error updating group mapping:', { error: error.message });
    res.status(500).json({ error: 'Failed to update group mapping' });
  }
});

// DELETE /api/sso/config/:id/groups/:mappingId - Delete group mapping
router.delete('/config/:id/groups/:mappingId', authenticateToken, async (req, res) => {
  try {
    const { id, mappingId } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    await SSOGroupService.deleteMapping(id, mappingId);

    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting group mapping:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete group mapping' });
  }
});

// ==================== ATTRIBUTE MAPPING ENDPOINTS ====================

// GET /api/sso/config/:id/attributes - Get attribute mappings
router.get('/config/:id/attributes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const mappings = await SSOGroupService.getAttributeMappings(id);

    res.json({ mappings });
  } catch (error) {
    log.error('Error getting attribute mappings:', { error: error.message });
    res.status(500).json({ error: 'Failed to get attribute mappings' });
  }
});

// POST /api/sso/config/:id/attributes - Create attribute mapping
router.post('/config/:id/attributes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const mapping = await SSOGroupService.createAttributeMapping(id, req.body);

    res.status(201).json({ mapping });
  } catch (error) {
    log.error('Error creating attribute mapping:', { error: error.message });
    res.status(500).json({ error: 'Failed to create attribute mapping' });
  }
});

// PUT /api/sso/config/:id/attributes/:mappingId - Update attribute mapping
router.put('/config/:id/attributes/:mappingId', authenticateToken, async (req, res) => {
  try {
    const { id, mappingId } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const mapping = await SSOGroupService.updateAttributeMapping(id, mappingId, req.body);

    res.json({ mapping });
  } catch (error) {
    log.error('Error updating attribute mapping:', { error: error.message });
    res.status(500).json({ error: 'Failed to update attribute mapping' });
  }
});

// DELETE /api/sso/config/:id/attributes/:mappingId - Delete attribute mapping
router.delete('/config/:id/attributes/:mappingId', authenticateToken, async (req, res) => {
  try {
    const { id, mappingId } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    await SSOGroupService.deleteAttributeMapping(id, mappingId);

    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting attribute mapping:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete attribute mapping' });
  }
});

// ==================== ANALYTICS ENDPOINTS ====================

// GET /api/sso/config/:id/analytics - Get SSO analytics
router.get('/config/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const analytics = await SSOAnalyticsService.getAnalytics(id, { startDate, endDate });

    res.json(analytics);
  } catch (error) {
    log.error('Error getting SSO analytics:', { error: error.message });
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// GET /api/sso/config/:id/analytics/realtime - Get real-time stats
router.get('/config/:id/analytics/realtime', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const stats = await SSOAnalyticsService.getRealTimeStats(id);

    res.json(stats);
  } catch (error) {
    log.error('Error getting real-time stats:', { error: error.message });
    res.status(500).json({ error: 'Failed to get real-time stats' });
  }
});

// GET /api/sso/config/:id/analytics/top-users - Get top users
router.get('/config/:id/analytics/top-users', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const users = await SSOAnalyticsService.getTopUsers(id, parseInt(limit));

    res.json({ users });
  } catch (error) {
    log.error('Error getting top users:', { error: error.message });
    res.status(500).json({ error: 'Failed to get top users' });
  }
});

// GET /api/sso/config/:id/analytics/export - Export analytics to CSV
router.get('/config/:id/analytics/export', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const orgId = req.user.current_organization_id || req.user.organization_id;

    const config = await verifyConfigOwnership(id, orgId);
    if (!config) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const csv = await SSOAnalyticsService.exportToCSV(id, { startDate, endDate });

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', `attachment; filename="sso-analytics-${id}.csv"`);
    res.send(csv);
  } catch (error) {
    log.error('Error exporting analytics:', { error: error.message });
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Process SSO user - create or update local user
 */
async function processSSoUser(configId, userAttributes, req) {
  const { email, externalId, firstName, lastName, displayName } = userAttributes;

  if (!email) {
    throw new Error('Email is required from SSO provider');
  }

  const configResult = await db.query('SELECT * FROM sso_configurations WHERE id = $1', [configId]);
  const config = configResult.rows[0];

  if (!config) {
    throw new Error('SSO configuration not found');
  }

  const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  let user = userResult.rows[0];

  if (!user) {
    const settings = typeof config.settings === 'string'
      ? JSON.parse(config.settings)
      : config.settings;

    if (settings?.auto_provision === false) {
      throw new Error('User does not exist and auto-provisioning is disabled');
    }

    const name = displayName || `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0];

    const newUserResult = await db.query(
      `INSERT INTO users (email, name, password_hash, email_verified, organization_id, created_at, updated_at)
       VALUES ($1, $2, null, true, $3, NOW(), NOW()) RETURNING *`,
      [email.toLowerCase(), name, config.organization_id]
    );
    user = newUserResult.rows[0];

    await db.query(
      `INSERT INTO team_members (tenant_id, user_id, role_id, status, joined_at)
       VALUES ($1, $2, $3, 'active', NOW())
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [config.organization_id, user.id, settings?.default_role_id || 2]
    );

    log.info('SSO user provisioned', { userId: user.id, email });
  }

  await SSOService.upsertUserMapping({
    configId,
    userId: user.id,
    externalId: externalId || email,
    email,
    attributes: userAttributes
  });

  return user;
}

/**
 * Generate JWT token for user
 */
function generateUserToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    organization_id: user.organization_id
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

module.exports = router;

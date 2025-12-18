/**
 * SSO Authentication Controller
 * Handles OIDC/SAML authentication flows
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const OIDCService = require('../services/oidcService');
const JWTValidationService = require('../services/jwtValidationService');
const SSOService = require('../services/ssoService');
const SSOAnalyticsService = require('../services/ssoAnalyticsService');
const EncryptionHelper = require('../services/ai/encryptionHelper');
const log = require('../utils/logger');

// Session state store (in production, use Redis)
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

class SSOAuthController {
  /**
   * Initiate OIDC Login
   * Generates auth URL with PKCE and redirects user
   */
  static async initiateOIDCLogin(req, res) {
    const startTime = Date.now();
    const { configId, domain, loginHint, prompt } = req.query;

    try {
      let config;

      // Get config by ID or domain
      if (configId) {
        config = await SSOService.getFullConfig(parseInt(configId));
      } else if (domain) {
        config = await SSOService.getConfigByDomain(domain);
      } else {
        return res.status(400).json({ error: 'Configuration ID or domain required' });
      }

      if (!config || !config.is_enabled) {
        return res.status(404).json({ error: 'SSO configuration not found or disabled' });
      }

      // Generate state, nonce, and PKCE
      const state = crypto.randomBytes(16).toString('hex');
      const nonce = crypto.randomBytes(16).toString('hex');
      const codeVerifier = OIDCService.generateCodeVerifier();
      const codeChallenge = OIDCService.generateCodeChallenge(codeVerifier);

      // Store session state
      ssoStateStore.set(state, {
        configId: config.id,
        nonce,
        codeVerifier,
        timestamp: Date.now(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Build authorization URL
      const authUrl = OIDCService.buildAuthorizationUrl(
        config,
        state,
        nonce,
        codeChallenge,
        {
          loginHint,
          prompt: prompt || (config.settings?.forceReauth ? 'login' : undefined)
        }
      );

      log.info('OIDC login initiated', { configId: config.id, state });

      // Redirect to IdP
      res.redirect(authUrl);

    } catch (error) {
      log.error('Error initiating OIDC login:', { error: error.message });

      // Record failed login attempt
      if (configId) {
        await SSOAnalyticsService.recordLogin(configId, {
          status: 'failed',
          error_message: error.message,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          login_time_ms: Date.now() - startTime
        }).catch(() => {});
      }

      res.redirect(`/login?error=sso_init_failed&message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Handle OIDC Callback
   * Exchanges code for tokens, validates, and creates session
   */
  static async handleOIDCCallback(req, res) {
    const startTime = Date.now();
    const { code, state, error, error_description } = req.query;

    try {
      // Handle IdP errors
      if (error) {
        log.warn('OIDC callback error from IdP:', { error, error_description });
        return res.redirect(`/login?error=sso_error&message=${encodeURIComponent(error_description || error)}`);
      }

      // Validate state
      if (!state || !ssoStateStore.has(state)) {
        log.warn('Invalid or expired state in OIDC callback');
        return res.redirect('/login?error=invalid_state');
      }

      const sessionState = ssoStateStore.get(state);
      ssoStateStore.delete(state); // Use once

      const { configId, nonce, codeVerifier } = sessionState;

      // Get SSO config
      const config = await SSOService.getFullConfig(configId);
      if (!config || !config.is_enabled) {
        return res.redirect('/login?error=sso_disabled');
      }

      // Exchange code for tokens
      const tokens = await OIDCService.exchangeCodeForTokens(configId, code, codeVerifier);

      if (!tokens || !tokens.id_token) {
        throw new Error('Failed to obtain tokens');
      }

      // Validate ID token
      const idTokenClaims = await OIDCService.validateIdToken(tokens.id_token, configId, nonce);

      // Validate at_hash if present
      if (idTokenClaims.at_hash && tokens.access_token) {
        const decoded = JWTValidationService.decodeToken(tokens.id_token);
        const atHashValid = OIDCService.validateAtHash(
          tokens.access_token,
          idTokenClaims.at_hash,
          decoded.header.alg
        );
        if (!atHashValid) {
          throw new Error('Invalid at_hash claim');
        }
      }

      // Get additional user info if available
      let userInfo = null;
      if (tokens.access_token) {
        try {
          userInfo = await OIDCService.getUserInfo(tokens.access_token, configId);
        } catch (e) {
          log.warn('Failed to get userinfo:', { error: e.message });
        }
      }

      // Extract user attributes
      const userAttributes = OIDCService.extractUserAttributes(idTokenClaims, userInfo);

      if (!userAttributes.email) {
        throw new Error('Email not provided in SSO response');
      }

      // JIT Provisioning - Find or create user
      const user = await this.findOrCreateUser(userAttributes, config);

      // Update SSO user mapping
      await this.updateSSOUserMapping(config.id, user.id, userAttributes, tokens);

      // Create session JWT
      const sessionToken = this.createSessionToken(user, config);

      // Store refresh token (encrypted)
      if (tokens.refresh_token) {
        await this.storeRefreshToken(user.id, config.id, tokens.refresh_token);
      }

      // Record successful login
      await SSOAnalyticsService.recordLogin(config.id, {
        user_id: user.id,
        email: userAttributes.email,
        status: 'success',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        login_time_ms: Date.now() - startTime
      }).catch(() => {});

      log.info('OIDC login successful', {
        configId,
        userId: user.id,
        email: userAttributes.email
      });

      // Set secure cookie with session token
      res.cookie('sso_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Redirect to SSO callback page with token
      res.redirect(`/sso/callback?token=${sessionToken}`);

    } catch (error) {
      log.error('Error handling OIDC callback:', { error: error.message });

      // Record failed login
      const sessionState = state ? ssoStateStore.get(state) : null;
      if (sessionState?.configId) {
        await SSOAnalyticsService.recordLogin(sessionState.configId, {
          status: 'failed',
          error_message: error.message,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          login_time_ms: Date.now() - startTime
        }).catch(() => {});
      }

      res.redirect(`/login?error=sso_failed&message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Handle OIDC Logout
   * Clears session and redirects to IdP logout
   */
  static async handleOIDCLogout(req, res) {
    try {
      const { configId } = req.body || req.query;
      const userId = req.user?.id;

      // Clear session cookie
      res.clearCookie('sso_session');

      if (!configId) {
        return res.redirect('/login');
      }

      const config = await SSOService.getFullConfig(parseInt(configId));

      if (!config) {
        return res.redirect('/login');
      }

      // Get stored ID token for logout hint
      let idToken = null;
      if (userId) {
        const mapping = await db('sso_user_mappings')
          .where({ sso_configuration_id: config.id, user_id: userId })
          .first();

        if (mapping?.attributes?.id_token) {
          idToken = mapping.attributes.id_token;
        }

        // Clear stored tokens
        await db('sso_user_mappings')
          .where({ sso_configuration_id: config.id, user_id: userId })
          .update({
            attributes: db.raw("attributes - 'id_token' - 'refresh_token'")
          });
      }

      // Get logout URL from IdP
      const logoutResult = await OIDCService.handleLogout(config, idToken);

      if (logoutResult?.url) {
        log.info('OIDC logout initiated', { configId, userId });
        return res.redirect(logoutResult.url);
      }

      res.redirect('/login');

    } catch (error) {
      log.error('Error handling OIDC logout:', { error: error.message });
      res.redirect('/login');
    }
  }

  /**
   * Refresh OIDC tokens
   */
  static async refreshTokens(req, res) {
    try {
      const { configId } = req.body;
      const userId = req.user?.id;

      if (!userId || !configId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Get stored refresh token
      const mapping = await db('sso_user_mappings')
        .where({ sso_configuration_id: configId, user_id: userId })
        .first();

      if (!mapping?.attributes?.refresh_token_encrypted) {
        return res.status(400).json({ error: 'No refresh token available' });
      }

      // Decrypt refresh token
      const refreshToken = EncryptionHelper.decrypt(mapping.attributes.refresh_token_encrypted);

      // Refresh tokens
      const newTokens = await OIDCService.refreshTokens(refreshToken, configId);

      // Store new refresh token if provided
      if (newTokens.refresh_token) {
        await this.storeRefreshToken(userId, configId, newTokens.refresh_token);
      }

      // Create new session token
      const user = await db('users').where({ id: userId }).first();
      const config = await SSOService.getFullConfig(configId);
      const sessionToken = this.createSessionToken(user, config);

      res.json({
        success: true,
        token: sessionToken,
        expires_in: newTokens.expires_in
      });

    } catch (error) {
      log.error('Error refreshing OIDC tokens:', { error: error.message });
      res.status(500).json({ error: 'Failed to refresh tokens' });
    }
  }

  /**
   * Get user info from IdP
   */
  static async getUserInfo(req, res) {
    try {
      const { configId } = req.query;
      const userId = req.user?.id;

      if (!userId || !configId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Get stored access token
      const mapping = await db('sso_user_mappings')
        .where({ sso_configuration_id: configId, user_id: userId })
        .first();

      if (!mapping?.attributes?.access_token_encrypted) {
        return res.status(400).json({ error: 'No access token available' });
      }

      // Decrypt access token
      const accessToken = EncryptionHelper.decrypt(mapping.attributes.access_token_encrypted);

      // Get user info
      const userInfo = await OIDCService.getUserInfo(accessToken, parseInt(configId));

      res.json({ userInfo });

    } catch (error) {
      log.error('Error getting user info:', { error: error.message });
      res.status(500).json({ error: 'Failed to get user info' });
    }
  }

  /**
   * Discover OIDC configuration
   */
  static async discoverConfiguration(req, res) {
    try {
      const { issuerUrl } = req.body;

      if (!issuerUrl) {
        return res.status(400).json({ error: 'Issuer URL required' });
      }

      const discovery = await OIDCService.discoverConfiguration(issuerUrl);

      res.json({ discovery });

    } catch (error) {
      log.error('Error discovering OIDC configuration:', { error: error.message });
      res.status(500).json({ error: 'Failed to discover configuration' });
    }
  }

  /**
   * Check domain for SSO
   */
  static async checkDomain(req, res) {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      const domain = email.split('@')[1];
      if (!domain) {
        return res.status(400).json({ error: 'Invalid email' });
      }

      const config = await SSOService.getConfigByDomain(domain);

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
      log.error('Error checking domain:', { error: error.message });
      res.status(500).json({ error: 'Failed to check domain' });
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Find or create user (JIT Provisioning)
   */
  static async findOrCreateUser(attributes, config) {
    const { email, displayName, firstName, lastName, externalId } = attributes;

    // Check for existing user
    let user = await db('users').where({ email }).first();

    if (user) {
      // Update user info if needed
      const updates = {};
      if (displayName && !user.name) updates.name = displayName;
      if (firstName && !user.first_name) updates.first_name = firstName;
      if (lastName && !user.last_name) updates.last_name = lastName;

      if (Object.keys(updates).length > 0) {
        await db('users').where({ id: user.id }).update(updates);
        user = { ...user, ...updates };
      }
    } else if (config.settings?.auto_provision !== false) {
      // Create new user
      const defaultRoleId = config.default_role_id || config.settings?.default_role_id || 2;

      const [newUser] = await db('users')
        .insert({
          email,
          name: displayName || `${firstName || ''} ${lastName || ''}`.trim() || email,
          first_name: firstName,
          last_name: lastName,
          organization_id: config.organization_id,
          role_id: defaultRoleId,
          is_verified: true, // SSO users are pre-verified
          sso_provider: config.provider_type,
          created_at: new Date()
        })
        .returning('*');

      user = newUser;

      log.info('JIT provisioned new user via SSO', {
        userId: user.id,
        email,
        configId: config.id
      });
    } else {
      throw new Error('User not found and auto-provisioning is disabled');
    }

    return user;
  }

  /**
   * Update SSO user mapping
   */
  static async updateSSOUserMapping(configId, userId, attributes, tokens) {
    const mappingData = {
      sso_configuration_id: configId,
      user_id: userId,
      external_id: attributes.externalId,
      email: attributes.email,
      attributes: JSON.stringify({
        ...attributes,
        id_token: tokens.id_token,
        access_token_encrypted: tokens.access_token ?
          EncryptionHelper.encrypt(tokens.access_token) : null
      }),
      last_login_at: new Date(),
      updated_at: new Date()
    };

    const existing = await db('sso_user_mappings')
      .where({ sso_configuration_id: configId, user_id: userId })
      .first();

    if (existing) {
      await db('sso_user_mappings')
        .where({ id: existing.id })
        .update(mappingData);
    } else {
      mappingData.created_at = new Date();
      await db('sso_user_mappings').insert(mappingData);
    }
  }

  /**
   * Create session JWT token
   */
  static createSessionToken(user, config) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      org: user.organization_id,
      role: user.role_id,
      sso: {
        provider: config.provider_type,
        configId: config.id
      }
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '24h',
      issuer: 'botbuilder'
    });
  }

  /**
   * Store encrypted refresh token
   */
  static async storeRefreshToken(userId, configId, refreshToken) {
    const encrypted = EncryptionHelper.encrypt(refreshToken);

    await db('sso_user_mappings')
      .where({ sso_configuration_id: configId, user_id: userId })
      .update({
        attributes: db.raw(`
          CASE
            WHEN attributes IS NULL THEN ?::jsonb
            ELSE attributes || ?::jsonb
          END
        `, [
          JSON.stringify({ refresh_token_encrypted: encrypted }),
          JSON.stringify({ refresh_token_encrypted: encrypted })
        ])
      });
  }
}

module.exports = SSOAuthController;

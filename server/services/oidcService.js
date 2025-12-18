/**
 * OIDC Service
 * Handles OpenID Connect authentication flows
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const SSOService = require('./ssoService');
const log = require('../utils/logger');

class OIDCService {
  // Cache for OIDC discovery documents
  static discoveryCache = new Map();
  static CACHE_TTL = 60 * 60 * 1000; // 1 hour

  /**
   * Generate OIDC Authorization URL
   * @param {number} configId - SSO Configuration ID
   * @param {string} state - State parameter
   * @returns {Object} { url, state, nonce }
   */
  static async generateAuthorizationUrl(configId, state = null) {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const redirectUri = `${baseUrl}/api/sso/oidc/callback`;

      // Generate state and nonce
      const generatedState = state || crypto.randomBytes(16).toString('hex');
      const nonce = crypto.randomBytes(16).toString('hex');

      // Get authorization URL
      let authorizationUrl = config.authorization_url;

      // If not set, try to discover
      if (!authorizationUrl && config.issuer_url) {
        const discovery = await this.fetchDiscoveryDocument(config.issuer_url);
        authorizationUrl = discovery?.authorization_endpoint;
      }

      if (!authorizationUrl) {
        throw new Error('Authorization URL not configured');
      }

      // Build URL with parameters
      const params = new URLSearchParams({
        client_id: config.client_id,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: config.scopes || 'openid profile email',
        state: generatedState,
        nonce: nonce
      });

      // Add PKCE if supported (recommended)
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');

      const url = `${authorizationUrl}?${params.toString()}`;

      log.info('OIDC authorization URL generated', { configId });

      return {
        url,
        state: generatedState,
        nonce,
        codeVerifier,
        redirectUri
      };
    } catch (error) {
      log.error('Error generating OIDC authorization URL:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   * @param {number} configId - SSO Configuration ID
   * @param {string} code - Authorization code
   * @param {string} codeVerifier - PKCE code verifier (optional)
   * @returns {Object} Tokens { access_token, id_token, refresh_token }
   */
  static async exchangeCodeForTokens(configId, code, codeVerifier = null) {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const redirectUri = `${baseUrl}/api/sso/oidc/callback`;

      // Get token URL
      let tokenUrl = config.token_url;

      if (!tokenUrl && config.issuer_url) {
        const discovery = await this.fetchDiscoveryDocument(config.issuer_url);
        tokenUrl = discovery?.token_endpoint;
      }

      if (!tokenUrl) {
        throw new Error('Token URL not configured');
      }

      // Build request body
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.client_id,
        client_secret: config.client_secret,
        code: code,
        redirect_uri: redirectUri
      });

      if (codeVerifier) {
        body.append('code_verifier', codeVerifier);
      }

      // Make token request
      const tokens = await this.makePostRequest(tokenUrl, body.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      log.info('OIDC tokens exchanged successfully', { configId });

      return tokens;
    } catch (error) {
      log.error('Error exchanging OIDC code for tokens:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Validate ID token
   * @param {string} idToken - JWT ID token
   * @param {number} configId - SSO Configuration ID
   * @param {string} nonce - Expected nonce
   * @returns {Object} Token claims
   */
  static async validateIdToken(idToken, configId, nonce = null) {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      // Decode JWT parts
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid ID token format');
      }

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

      // Validate issuer
      const expectedIssuer = config.issuer_url;
      if (payload.iss && expectedIssuer && !payload.iss.startsWith(expectedIssuer.replace(/\/$/, ''))) {
        throw new Error('Invalid token issuer');
      }

      // Validate audience
      const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!aud.includes(config.client_id)) {
        throw new Error('Invalid token audience');
      }

      // Validate expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('ID token has expired');
      }

      // Validate nonce
      if (nonce && payload.nonce !== nonce) {
        throw new Error('Invalid token nonce');
      }

      // Optionally verify signature with JWKS
      if (config.jwks_url || config.issuer_url) {
        const jwksUrl = config.jwks_url ||
          (await this.fetchDiscoveryDocument(config.issuer_url))?.jwks_uri;

        if (jwksUrl) {
          const isValid = await this.verifyTokenSignature(idToken, jwksUrl, header.kid);
          if (!isValid && process.env.NODE_ENV === 'production') {
            throw new Error('Invalid token signature');
          }
        }
      }

      log.info('OIDC ID token validated', { configId, sub: payload.sub });

      return payload;
    } catch (error) {
      log.error('Error validating OIDC ID token:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Get user info from userinfo endpoint
   * @param {string} accessToken - Access token
   * @param {number} configId - SSO Configuration ID
   * @returns {Object} User info
   */
  static async getUserInfo(accessToken, configId) {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      // Get userinfo URL
      let userinfoUrl = config.userinfo_url;

      if (!userinfoUrl && config.issuer_url) {
        const discovery = await this.fetchDiscoveryDocument(config.issuer_url);
        userinfoUrl = discovery?.userinfo_endpoint;
      }

      if (!userinfoUrl) {
        log.warn('Userinfo URL not configured', { configId });
        return null;
      }

      // Make request
      const userInfo = await this.makeGetRequest(userinfoUrl, {
        'Authorization': `Bearer ${accessToken}`
      });

      log.info('OIDC user info retrieved', { configId, sub: userInfo.sub });

      return userInfo;
    } catch (error) {
      log.error('Error getting OIDC user info:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @param {number} configId - SSO Configuration ID
   * @returns {Object} New tokens
   */
  static async refreshTokens(refreshToken, configId) {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      // Get token URL
      let tokenUrl = config.token_url;

      if (!tokenUrl && config.issuer_url) {
        const discovery = await this.fetchDiscoveryDocument(config.issuer_url);
        tokenUrl = discovery?.token_endpoint;
      }

      if (!tokenUrl) {
        throw new Error('Token URL not configured');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.client_id,
        client_secret: config.client_secret,
        refresh_token: refreshToken
      });

      const tokens = await this.makePostRequest(tokenUrl, body.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      log.info('OIDC tokens refreshed', { configId });

      return tokens;
    } catch (error) {
      log.error('Error refreshing OIDC tokens:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Revoke tokens (logout)
   * @param {number} configId - SSO Configuration ID
   * @param {string} token - Token to revoke
   * @param {string} tokenType - 'access_token' or 'refresh_token'
   * @returns {boolean} Success
   */
  static async revokeTokens(configId, token, tokenType = 'refresh_token') {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      // Get revocation URL from discovery
      const discovery = await this.fetchDiscoveryDocument(config.issuer_url);
      const revocationUrl = discovery?.revocation_endpoint;

      if (!revocationUrl) {
        log.warn('Revocation endpoint not available', { configId });
        return true; // Consider it success if endpoint not available
      }

      const body = new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        token: token,
        token_type_hint: tokenType
      });

      await this.makePostRequest(revocationUrl, body.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      log.info('OIDC token revoked', { configId });

      return true;
    } catch (error) {
      log.error('Error revoking OIDC token:', { error: error.message, configId });
      // Don't throw - revocation failure shouldn't break logout
      return false;
    }
  }

  /**
   * Get end session URL for logout
   * @param {number} configId - SSO Configuration ID
   * @param {string} idToken - ID token for logout hint
   * @returns {string|null} Logout URL
   */
  static async getEndSessionUrl(configId, idToken = null) {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        return null;
      }

      const discovery = await this.fetchDiscoveryDocument(config.issuer_url);
      const endSessionUrl = discovery?.end_session_endpoint;

      if (!endSessionUrl) {
        return null;
      }

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const params = new URLSearchParams({
        client_id: config.client_id,
        post_logout_redirect_uri: `${baseUrl}/login`
      });

      if (idToken) {
        params.append('id_token_hint', idToken);
      }

      return `${endSessionUrl}?${params.toString()}`;
    } catch (error) {
      log.error('Error getting end session URL:', { error: error.message, configId });
      return null;
    }
  }

  /**
   * Fetch OIDC discovery document
   * @param {string} issuerUrl - Issuer URL
   * @returns {Object|null} Discovery document
   */
  static async fetchDiscoveryDocument(issuerUrl) {
    if (!issuerUrl) return null;

    // Check cache
    const cacheKey = issuerUrl;
    const cached = this.discoveryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.document;
    }

    try {
      const wellKnownUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
      const document = await this.makeGetRequest(wellKnownUrl);

      // Cache the result
      this.discoveryCache.set(cacheKey, {
        document,
        timestamp: Date.now()
      });

      return document;
    } catch (error) {
      log.error('Error fetching OIDC discovery document:', { error: error.message, issuerUrl });
      return null;
    }
  }

  /**
   * Verify JWT signature using JWKS
   * @param {string} token - JWT token
   * @param {string} jwksUrl - JWKS URL
   * @param {string} kid - Key ID
   * @returns {boolean} Is valid
   */
  static async verifyTokenSignature(token, jwksUrl, kid) {
    try {
      const jwks = await this.makeGetRequest(jwksUrl);

      if (!jwks || !jwks.keys) {
        return false;
      }

      // Find the key
      const key = jwks.keys.find(k => k.kid === kid) || jwks.keys[0];

      if (!key) {
        return false;
      }

      // Convert JWK to PEM
      const pem = this.jwkToPem(key);

      // Verify signature
      const parts = token.split('.');
      const signatureInput = parts[0] + '.' + parts[1];
      const signature = Buffer.from(parts[2], 'base64url');

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(signatureInput);

      return verifier.verify(pem, signature);
    } catch (error) {
      log.error('Error verifying token signature:', { error: error.message });
      return false;
    }
  }

  /**
   * Convert JWK to PEM format
   * @param {Object} jwk - JSON Web Key
   * @returns {string} PEM formatted key
   */
  static jwkToPem(jwk) {
    if (jwk.kty !== 'RSA') {
      throw new Error('Only RSA keys are supported');
    }

    // Simple conversion - in production use a library like jwk-to-pem
    const n = Buffer.from(jwk.n, 'base64url');
    const e = Buffer.from(jwk.e, 'base64url');

    // Build DER encoded public key
    const modulus = n[0] & 0x80 ? Buffer.concat([Buffer.from([0]), n]) : n;
    const exponent = e[0] & 0x80 ? Buffer.concat([Buffer.from([0]), e]) : e;

    const modulusLen = this.derLength(modulus.length);
    const exponentLen = this.derLength(exponent.length);

    const sequenceLen = this.derLength(
      2 + modulusLen.length + modulus.length +
      2 + exponentLen.length + exponent.length
    );

    const pubKeySequence = Buffer.concat([
      Buffer.from([0x30]), sequenceLen,
      Buffer.from([0x02]), modulusLen, modulus,
      Buffer.from([0x02]), exponentLen, exponent
    ]);

    // OID for RSA encryption
    const rsaOid = Buffer.from([
      0x30, 0x0d,
      0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
      0x05, 0x00
    ]);

    const bitString = Buffer.concat([
      Buffer.from([0x03]),
      this.derLength(pubKeySequence.length + 1),
      Buffer.from([0x00]),
      pubKeySequence
    ]);

    const fullSequence = Buffer.concat([
      Buffer.from([0x30]),
      this.derLength(rsaOid.length + bitString.length),
      rsaOid,
      bitString
    ]);

    const base64 = fullSequence.toString('base64');
    const lines = base64.match(/.{1,64}/g) || [];

    return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
  }

  /**
   * Create DER length encoding
   * @param {number} length - Length value
   * @returns {Buffer} DER encoded length
   */
  static derLength(length) {
    if (length < 128) {
      return Buffer.from([length]);
    } else if (length < 256) {
      return Buffer.from([0x81, length]);
    } else {
      return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
    }
  }

  /**
   * Make HTTP POST request
   * @param {string} url - Request URL
   * @param {string} body - Request body
   * @param {Object} headers - Request headers
   * @returns {Object} Response body
   */
  static makePostRequest(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Length': Buffer.byteLength(body),
          ...headers
        },
        timeout: 30000
      };

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(parsed.error_description || parsed.error || 'Request failed'));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            } else {
              resolve(data);
            }
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Make HTTP GET request
   * @param {string} url - Request URL
   * @param {Object} headers - Request headers
   * @returns {Object} Response body
   */
  static makeGetRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers,
        timeout: 30000
      };

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Extract user attributes from OIDC claims
   * @param {Object} idTokenClaims - ID token claims
   * @param {Object} userInfo - Userinfo response
   * @returns {Object} Normalized user attributes
   */
  static extractUserAttributes(idTokenClaims, userInfo = {}) {
    const merged = { ...idTokenClaims, ...userInfo };

    return {
      externalId: merged.sub,
      email: merged.email,
      emailVerified: merged.email_verified,
      firstName: merged.given_name,
      lastName: merged.family_name,
      displayName: merged.name,
      picture: merged.picture,
      locale: merged.locale,
      groups: merged.groups || []
    };
  }

  /**
   * Discover and return full OIDC configuration
   * @param {string} issuerUrl - Issuer URL
   * @returns {Object} Full discovery configuration
   */
  static async discoverConfiguration(issuerUrl) {
    try {
      const document = await this.fetchDiscoveryDocument(issuerUrl);

      if (!document) {
        throw new Error('Failed to fetch discovery document');
      }

      return {
        issuer: document.issuer,
        authorization_endpoint: document.authorization_endpoint,
        token_endpoint: document.token_endpoint,
        userinfo_endpoint: document.userinfo_endpoint,
        jwks_uri: document.jwks_uri,
        end_session_endpoint: document.end_session_endpoint,
        revocation_endpoint: document.revocation_endpoint,
        introspection_endpoint: document.introspection_endpoint,
        scopes_supported: document.scopes_supported || ['openid', 'profile', 'email'],
        response_types_supported: document.response_types_supported || ['code'],
        grant_types_supported: document.grant_types_supported || ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: document.token_endpoint_auth_methods_supported || ['client_secret_basic', 'client_secret_post'],
        code_challenge_methods_supported: document.code_challenge_methods_supported || ['S256'],
        claims_supported: document.claims_supported || []
      };
    } catch (error) {
      log.error('Error discovering OIDC configuration:', { error: error.message, issuerUrl });
      throw error;
    }
  }

  /**
   * Generate PKCE code verifier
   * @returns {string} Code verifier (43-128 chars)
   */
  static generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge from verifier (S256)
   * @param {string} verifier - Code verifier
   * @returns {string} Code challenge
   */
  static generateCodeChallenge(verifier) {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * Validate at_hash claim in ID token
   * @param {string} accessToken - Access token
   * @param {string} atHash - at_hash claim from ID token
   * @param {string} algorithm - Hash algorithm (RS256, RS384, RS512)
   * @returns {boolean} Is valid
   */
  static validateAtHash(accessToken, atHash, algorithm = 'RS256') {
    if (!atHash) return true; // at_hash is optional

    const hashAlg = algorithm.replace('RS', 'sha');
    const hash = crypto.createHash(hashAlg).update(accessToken).digest();
    const halfHash = hash.slice(0, hash.length / 2);
    const computedAtHash = halfHash.toString('base64url');

    return computedAtHash === atHash;
  }

  /**
   * Build full authorization URL with all parameters
   * @param {Object} config - SSO configuration
   * @param {string} state - State parameter
   * @param {string} nonce - Nonce parameter
   * @param {string} codeChallenge - PKCE code challenge
   * @param {Object} options - Additional options
   * @returns {string} Full authorization URL
   */
  static buildAuthorizationUrl(config, state, nonce, codeChallenge, options = {}) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = options.redirectUri || `${baseUrl}/api/sso/oidc/callback`;

    const params = new URLSearchParams({
      client_id: config.client_id,
      redirect_uri: redirectUri,
      response_type: options.responseType || 'code',
      scope: config.scopes || 'openid profile email',
      state: state,
      nonce: nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    // Add optional parameters
    if (options.prompt) params.append('prompt', options.prompt);
    if (options.loginHint) params.append('login_hint', options.loginHint);
    if (options.acrValues) params.append('acr_values', options.acrValues);

    return `${config.authorization_url}?${params.toString()}`;
  }

  /**
   * Handle RP-Initiated Logout
   * @param {Object} config - SSO configuration
   * @param {string} idToken - ID token for logout hint
   * @param {string} postLogoutRedirectUri - Post-logout redirect URI
   * @returns {string|null} Logout URL
   */
  static async handleLogout(config, idToken = null, postLogoutRedirectUri = null) {
    try {
      const discovery = await this.fetchDiscoveryDocument(config.issuer_url);
      const endSessionUrl = discovery?.end_session_endpoint;

      if (!endSessionUrl) {
        return null;
      }

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const params = new URLSearchParams({
        client_id: config.client_id,
        post_logout_redirect_uri: postLogoutRedirectUri || `${baseUrl}/login`
      });

      if (idToken) {
        params.append('id_token_hint', idToken);
      }

      // Generate state for logout
      const state = crypto.randomBytes(16).toString('hex');
      params.append('state', state);

      return {
        url: `${endSessionUrl}?${params.toString()}`,
        state
      };
    } catch (error) {
      log.error('Error handling logout:', { error: error.message });
      return null;
    }
  }
}

module.exports = OIDCService;

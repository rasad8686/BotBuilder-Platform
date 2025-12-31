/**
 * OIDC Service Tests
 * Tests for server/services/oidcService.js
 */

jest.mock('https', () => ({
  request: jest.fn()
}));

jest.mock('http', () => ({
  request: jest.fn()
}));

jest.mock('../../services/ssoService', () => ({
  getFullConfig: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const https = require('https');
const http = require('http');
const SSOService = require('../../services/ssoService');
const OIDCService = require('../../services/oidcService');

describe('OIDC Service', () => {
  const mockConfig = {
    id: 1,
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    issuer_url: 'https://issuer.example.com',
    authorization_url: 'https://issuer.example.com/authorize',
    token_url: 'https://issuer.example.com/token',
    userinfo_url: 'https://issuer.example.com/userinfo',
    jwks_url: 'https://issuer.example.com/.well-known/jwks.json',
    scopes: 'openid profile email'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    OIDCService.discoveryCache.clear();
  });

  describe('generateAuthorizationUrl', () => {
    it('should generate authorization URL with PKCE', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      const result = await OIDCService.generateAuthorizationUrl(1);

      expect(result.url).toContain('client_id=test-client-id');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('code_challenge=');
      expect(result.url).toContain('code_challenge_method=S256');
      expect(result.state).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(result.codeVerifier).toBeDefined();
    });

    it('should use provided state', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      const result = await OIDCService.generateAuthorizationUrl(1, 'custom-state');

      expect(result.state).toBe('custom-state');
      expect(result.url).toContain('state=custom-state');
    });

    it('should throw if config not found', async () => {
      SSOService.getFullConfig.mockResolvedValue(null);

      await expect(OIDCService.generateAuthorizationUrl(999))
        .rejects.toThrow('SSO configuration not found');
    });

    it('should discover authorization URL if not configured', async () => {
      const configWithoutAuthUrl = { ...mockConfig, authorization_url: null };
      SSOService.getFullConfig.mockResolvedValue(configWithoutAuthUrl);

      const mockDiscovery = {
        authorization_endpoint: 'https://discovered.example.com/authorize'
      };

      // Mock discovery fetch
      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue(mockDiscovery);

      const result = await OIDCService.generateAuthorizationUrl(1);

      expect(result.url).toContain('https://discovered.example.com/authorize');
    });

    it('should throw if no authorization URL available', async () => {
      const configWithoutAuthUrl = { ...mockConfig, authorization_url: null, issuer_url: null };
      SSOService.getFullConfig.mockResolvedValue(configWithoutAuthUrl);

      await expect(OIDCService.generateAuthorizationUrl(1))
        .rejects.toThrow('Authorization URL not configured');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      const mockTokens = {
        access_token: 'access-token',
        id_token: 'id-token',
        refresh_token: 'refresh-token'
      };

      jest.spyOn(OIDCService, 'makePostRequest').mockResolvedValue(mockTokens);

      const result = await OIDCService.exchangeCodeForTokens(1, 'auth-code');

      expect(result.access_token).toBe('access-token');
      expect(OIDCService.makePostRequest).toHaveBeenCalledWith(
        mockConfig.token_url,
        expect.stringContaining('grant_type=authorization_code'),
        expect.any(Object)
      );
    });

    it('should include code_verifier if provided', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);
      jest.spyOn(OIDCService, 'makePostRequest').mockResolvedValue({});

      await OIDCService.exchangeCodeForTokens(1, 'auth-code', 'verifier-123');

      expect(OIDCService.makePostRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('code_verifier=verifier-123'),
        expect.any(Object)
      );
    });

    it('should throw if config not found', async () => {
      SSOService.getFullConfig.mockResolvedValue(null);

      await expect(OIDCService.exchangeCodeForTokens(1, 'code'))
        .rejects.toThrow('SSO configuration not found');
    });

    it('should discover token URL if not configured', async () => {
      const configWithoutTokenUrl = { ...mockConfig, token_url: null };
      SSOService.getFullConfig.mockResolvedValue(configWithoutTokenUrl);

      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue({
        token_endpoint: 'https://discovered.example.com/token'
      });
      jest.spyOn(OIDCService, 'makePostRequest').mockResolvedValue({});

      await OIDCService.exchangeCodeForTokens(1, 'code');

      expect(OIDCService.makePostRequest).toHaveBeenCalledWith(
        'https://discovered.example.com/token',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('validateIdToken', () => {
    it('should validate ID token claims', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        sub: 'user-123',
        email: 'user@test.com',
        iss: 'https://issuer.example.com',
        aud: 'test-client-id',
        exp: now + 3600,
        nonce: 'test-nonce'
      };

      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const idToken = `${header}.${payloadB64}.signature`;

      // Skip signature verification
      jest.spyOn(OIDCService, 'verifyTokenSignature').mockResolvedValue(true);

      const result = await OIDCService.validateIdToken(idToken, 1, 'test-nonce');

      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('user@test.com');
    });

    it('should throw if config not found', async () => {
      SSOService.getFullConfig.mockResolvedValue(null);

      await expect(OIDCService.validateIdToken('token', 999))
        .rejects.toThrow('SSO configuration not found');
    });

    it('should throw for invalid token format', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      await expect(OIDCService.validateIdToken('invalid', 1))
        .rejects.toThrow('Invalid ID token format');
    });

    it('should throw for expired token', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        sub: 'user-123',
        aud: 'test-client-id',
        exp: now - 3600 // Expired
      };

      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const idToken = `${header}.${payloadB64}.signature`;

      await expect(OIDCService.validateIdToken(idToken, 1))
        .rejects.toThrow('ID token has expired');
    });

    it('should throw for invalid nonce', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        sub: 'user-123',
        aud: 'test-client-id',
        exp: now + 3600,
        nonce: 'wrong-nonce'
      };

      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const idToken = `${header}.${payloadB64}.signature`;

      await expect(OIDCService.validateIdToken(idToken, 1, 'expected-nonce'))
        .rejects.toThrow('Invalid token nonce');
    });
  });

  describe('getUserInfo', () => {
    it('should get user info from endpoint', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      const mockUserInfo = {
        sub: 'user-123',
        email: 'user@test.com',
        name: 'Test User'
      };

      jest.spyOn(OIDCService, 'makeGetRequest').mockResolvedValue(mockUserInfo);

      const result = await OIDCService.getUserInfo('access-token', 1);

      expect(result.sub).toBe('user-123');
      expect(OIDCService.makeGetRequest).toHaveBeenCalledWith(
        mockConfig.userinfo_url,
        { 'Authorization': 'Bearer access-token' }
      );
    });

    it('should return null if no userinfo URL', async () => {
      const configWithoutUserinfo = { ...mockConfig, userinfo_url: null, issuer_url: null };
      SSOService.getFullConfig.mockResolvedValue(configWithoutUserinfo);

      const result = await OIDCService.getUserInfo('access-token', 1);

      expect(result).toBeNull();
    });

    it('should throw if config not found', async () => {
      SSOService.getFullConfig.mockResolvedValue(null);

      await expect(OIDCService.getUserInfo('token', 999))
        .rejects.toThrow('SSO configuration not found');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      const mockNewTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      };

      jest.spyOn(OIDCService, 'makePostRequest').mockResolvedValue(mockNewTokens);

      const result = await OIDCService.refreshTokens('old-refresh-token', 1);

      expect(result.access_token).toBe('new-access-token');
      expect(OIDCService.makePostRequest).toHaveBeenCalledWith(
        mockConfig.token_url,
        expect.stringContaining('grant_type=refresh_token'),
        expect.any(Object)
      );
    });

    it('should throw if config not found', async () => {
      SSOService.getFullConfig.mockResolvedValue(null);

      await expect(OIDCService.refreshTokens('token', 999))
        .rejects.toThrow('SSO configuration not found');
    });
  });

  describe('revokeTokens', () => {
    it('should revoke tokens', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue({
        revocation_endpoint: 'https://issuer.example.com/revoke'
      });
      jest.spyOn(OIDCService, 'makePostRequest').mockResolvedValue({});

      const result = await OIDCService.revokeTokens(1, 'token-to-revoke');

      expect(result).toBe(true);
    });

    it('should return true if no revocation endpoint', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue({});

      const result = await OIDCService.revokeTokens(1, 'token');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue({
        revocation_endpoint: 'https://issuer.example.com/revoke'
      });
      jest.spyOn(OIDCService, 'makePostRequest').mockRejectedValue(new Error('Failed'));

      const result = await OIDCService.revokeTokens(1, 'token');

      expect(result).toBe(false);
    });
  });

  describe('getEndSessionUrl', () => {
    it('should return end session URL', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue({
        end_session_endpoint: 'https://issuer.example.com/logout'
      });

      const result = await OIDCService.getEndSessionUrl(1, 'id-token');

      expect(result).toContain('https://issuer.example.com/logout');
      expect(result).toContain('id_token_hint=id-token');
      expect(result).toContain('client_id=test-client-id');
    });

    it('should return null if config not found', async () => {
      SSOService.getFullConfig.mockResolvedValue(null);

      const result = await OIDCService.getEndSessionUrl(999);

      expect(result).toBeNull();
    });

    it('should return null if no end_session_endpoint', async () => {
      SSOService.getFullConfig.mockResolvedValue(mockConfig);

      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue({});

      const result = await OIDCService.getEndSessionUrl(1);

      expect(result).toBeNull();
    });
  });

  describe('fetchDiscoveryDocument', () => {
    beforeEach(() => {
      // Restore all mocks to prevent spillover from other tests
      jest.restoreAllMocks();
      // Clear cache for each test
      if (OIDCService.discoveryCache) {
        OIDCService.discoveryCache.clear();
      }
    });

    it('should return cached document when available', async () => {
      const mockDocument = { issuer: 'https://issuer.example.com' };

      // Mock makeGetRequest to return the discovery document
      const spy = jest.spyOn(OIDCService, 'makeGetRequest').mockResolvedValue(mockDocument);

      // First call - should fetch and cache
      const result1 = await OIDCService.fetchDiscoveryDocument('https://issuer.example.com');

      // Second call - should return cached version
      const result2 = await OIDCService.fetchDiscoveryDocument('https://issuer.example.com');

      // Both should return the document
      expect(result1).toEqual(mockDocument);
      expect(result2).toEqual(mockDocument);
      // makeGetRequest should only be called once (cached on second call)
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });

    it('should handle null issuer URL gracefully', async () => {
      // Null issuer should return null immediately without calling makeGetRequest
      const result = await OIDCService.fetchDiscoveryDocument(null);
      // Should return null for invalid input (falsy check at line 389)
      expect(result).toBeNull();
    });

    it('should handle empty string issuer URL gracefully', async () => {
      // Empty string is falsy, should return null immediately
      const result = await OIDCService.fetchDiscoveryDocument('');
      expect(result).toBeNull();
    });

    it('should handle undefined issuer URL gracefully', async () => {
      // Undefined is falsy, should return null immediately
      const result = await OIDCService.fetchDiscoveryDocument(undefined);
      expect(result).toBeNull();
    });
  });

  describe('derLength', () => {
    it('should encode short lengths (< 128)', () => {
      const result = OIDCService.derLength(50);
      expect(result).toEqual(Buffer.from([50]));
    });

    it('should encode medium lengths (128-255)', () => {
      const result = OIDCService.derLength(200);
      expect(result).toEqual(Buffer.from([0x81, 200]));
    });

    it('should encode long lengths (256+)', () => {
      const result = OIDCService.derLength(500);
      expect(result).toEqual(Buffer.from([0x82, 0x01, 0xf4]));
    });
  });

  describe('jwkToPem', () => {
    it('should throw for non-RSA keys', () => {
      expect(() => OIDCService.jwkToPem({ kty: 'EC' }))
        .toThrow('Only RSA keys are supported');
    });

    it('should convert RSA JWK to PEM', () => {
      const jwk = {
        kty: 'RSA',
        n: 'sXch3mFgPOXDjOxP_cKL',
        e: 'AQAB'
      };

      const result = OIDCService.jwkToPem(jwk);

      expect(result).toContain('-----BEGIN PUBLIC KEY-----');
      expect(result).toContain('-----END PUBLIC KEY-----');
    });
  });

  describe('extractUserAttributes', () => {
    it('should extract user attributes from claims', () => {
      const claims = {
        sub: 'user-123',
        email: 'user@test.com',
        email_verified: true,
        given_name: 'Test',
        family_name: 'User',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        locale: 'en-US',
        groups: ['admin', 'users']
      };

      const result = OIDCService.extractUserAttributes(claims);

      expect(result.externalId).toBe('user-123');
      expect(result.email).toBe('user@test.com');
      expect(result.emailVerified).toBe(true);
      expect(result.firstName).toBe('Test');
      expect(result.lastName).toBe('User');
      expect(result.displayName).toBe('Test User');
      expect(result.groups).toEqual(['admin', 'users']);
    });

    it('should merge ID token claims and userinfo', () => {
      const idTokenClaims = { sub: 'user-123', email: 'user@test.com' };
      const userInfo = { name: 'Test User', picture: 'https://example.com/photo.jpg' };

      const result = OIDCService.extractUserAttributes(idTokenClaims, userInfo);

      expect(result.externalId).toBe('user-123');
      expect(result.displayName).toBe('Test User');
    });
  });

  describe('discoverConfiguration', () => {
    it('should return full configuration from discovery', async () => {
      const mockDocument = {
        issuer: 'https://issuer.example.com',
        authorization_endpoint: 'https://issuer.example.com/authorize',
        token_endpoint: 'https://issuer.example.com/token',
        userinfo_endpoint: 'https://issuer.example.com/userinfo',
        jwks_uri: 'https://issuer.example.com/jwks',
        scopes_supported: ['openid', 'profile', 'email']
      };

      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue(mockDocument);

      const result = await OIDCService.discoverConfiguration('https://issuer.example.com');

      expect(result.issuer).toBe('https://issuer.example.com');
      expect(result.authorization_endpoint).toBe('https://issuer.example.com/authorize');
    });

    it('should throw if discovery fails', async () => {
      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue(null);

      await expect(OIDCService.discoverConfiguration('https://invalid.com'))
        .rejects.toThrow('Failed to fetch discovery document');
    });
  });

  describe('generateCodeVerifier', () => {
    it('should generate code verifier', () => {
      const result = OIDCService.generateCodeVerifier();

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(40);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate code challenge from verifier', () => {
      const verifier = 'test-verifier';
      const result = OIDCService.generateCodeChallenge(verifier);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('validateAtHash', () => {
    it('should return true if at_hash is not present', () => {
      const result = OIDCService.validateAtHash('access-token', null);
      expect(result).toBe(true);
    });

    it('should validate at_hash claim', () => {
      const accessToken = 'test-access-token';
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(accessToken).digest();
      const halfHash = hash.slice(0, hash.length / 2);
      const atHash = halfHash.toString('base64url');

      const result = OIDCService.validateAtHash(accessToken, atHash);
      expect(result).toBe(true);
    });

    it('should reject invalid at_hash', () => {
      const result = OIDCService.validateAtHash('access-token', 'invalid-hash');
      expect(result).toBe(false);
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('should build authorization URL with all parameters', () => {
      const config = {
        client_id: 'test-client',
        authorization_url: 'https://example.com/authorize',
        scopes: 'openid profile'
      };

      const result = OIDCService.buildAuthorizationUrl(
        config,
        'state-123',
        'nonce-456',
        'challenge-789',
        { prompt: 'consent', loginHint: 'user@test.com' }
      );

      expect(result).toContain('client_id=test-client');
      expect(result).toContain('state=state-123');
      expect(result).toContain('nonce=nonce-456');
      expect(result).toContain('code_challenge=challenge-789');
      expect(result).toContain('prompt=consent');
      expect(result).toContain('login_hint=user%40test.com');
    });
  });

  describe('handleLogout', () => {
    it('should return logout URL with state', async () => {
      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue({
        end_session_endpoint: 'https://example.com/logout'
      });

      const config = { issuer_url: 'https://example.com', client_id: 'test' };
      const result = await OIDCService.handleLogout(config, 'id-token');

      expect(result.url).toContain('https://example.com/logout');
      expect(result.url).toContain('id_token_hint=id-token');
      expect(result.state).toBeDefined();
    });

    it('should return null if no end_session_endpoint', async () => {
      jest.spyOn(OIDCService, 'fetchDiscoveryDocument').mockResolvedValue({});

      const result = await OIDCService.handleLogout({ issuer_url: 'https://example.com' });

      expect(result).toBeNull();
    });
  });
});

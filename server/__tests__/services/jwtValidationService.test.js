/**
 * JWT Validation Service Tests
 * Tests for server/services/jwtValidationService.js
 */

jest.mock('https', () => ({
  request: jest.fn()
}));

jest.mock('http', () => ({
  request: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const https = require('https');
const http = require('http');
const JWTValidationService = require('../../services/jwtValidationService');

describe('JWT Validation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    JWTValidationService.clearCache();
  });

  describe('fetchJWKS', () => {
    it('should fetch JWKS from HTTPS endpoint', async () => {
      const mockJWKS = {
        keys: [{ kid: 'key1', kty: 'RSA', n: 'abc', e: 'AQAB' }]
      };

      const mockResponse = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback(JSON.stringify(mockJWKS));
          if (event === 'end') callback();
          return mockResponse;
        })
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await JWTValidationService.fetchJWKS('https://example.com/.well-known/jwks.json');

      expect(result).toEqual(mockJWKS);
      expect(https.request).toHaveBeenCalled();
    });

    it('should fetch JWKS from HTTP endpoint', async () => {
      const mockJWKS = {
        keys: [{ kid: 'key1', kty: 'RSA', n: 'abc', e: 'AQAB' }]
      };

      const mockResponse = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback(JSON.stringify(mockJWKS));
          if (event === 'end') callback();
          return mockResponse;
        })
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn()
      };

      http.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await JWTValidationService.fetchJWKS('http://localhost/.well-known/jwks.json');

      expect(result).toEqual(mockJWKS);
      expect(http.request).toHaveBeenCalled();
    });

    it('should reject on invalid JSON response', async () => {
      const mockResponse = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback('not valid json');
          if (event === 'end') callback();
          return mockResponse;
        })
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(JWTValidationService.fetchJWKS('https://example.com/.well-known/jwks.json'))
        .rejects.toThrow('Invalid JWKS response');
    });

    it('should reject on request error', async () => {
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'error') callback(new Error('Connection refused'));
          return mockRequest;
        }),
        end: jest.fn()
      };

      https.request.mockImplementation(() => mockRequest);

      await expect(JWTValidationService.fetchJWKS('https://example.com/.well-known/jwks.json'))
        .rejects.toThrow('Connection refused');
    });

    it('should reject on timeout', async () => {
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'timeout') callback();
          return mockRequest;
        }),
        end: jest.fn(),
        destroy: jest.fn()
      };

      https.request.mockImplementation(() => mockRequest);

      await expect(JWTValidationService.fetchJWKS('https://example.com/.well-known/jwks.json'))
        .rejects.toThrow('JWKS fetch timeout');
    });
  });

  describe('cacheJWKS and getCachedJWKS', () => {
    it('should cache and retrieve JWKS', () => {
      const keys = [{ kid: 'key1', kty: 'RSA' }];

      JWTValidationService.cacheJWKS('issuer1', keys);

      const cached = JWTValidationService.getCachedJWKS('issuer1');
      expect(cached).toEqual(keys);
    });

    it('should return null for uncached issuer', () => {
      const cached = JWTValidationService.getCachedJWKS('unknown-issuer');
      expect(cached).toBeNull();
    });

    it('should return null for expired cache', () => {
      const keys = [{ kid: 'key1', kty: 'RSA' }];

      // Mock Date.now to simulate expired cache
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 0);

      JWTValidationService.cacheJWKS('issuer1', keys);

      // Move time forward past TTL
      Date.now = jest.fn(() => JWTValidationService.CACHE_TTL + 1000);

      const cached = JWTValidationService.getCachedJWKS('issuer1');
      expect(cached).toBeNull();

      Date.now = originalDateNow;
    });
  });

  describe('derLength', () => {
    it('should encode short lengths (< 128)', () => {
      const result = JWTValidationService.derLength(50);
      expect(result).toEqual(Buffer.from([50]));
    });

    it('should encode medium lengths (128-255)', () => {
      const result = JWTValidationService.derLength(200);
      expect(result).toEqual(Buffer.from([0x81, 200]));
    });

    it('should encode long lengths (256+)', () => {
      const result = JWTValidationService.derLength(500);
      expect(result).toEqual(Buffer.from([0x82, 0x01, 0xf4]));
    });
  });

  describe('jwkToPem', () => {
    it('should convert RSA JWK to PEM', () => {
      const jwk = {
        kty: 'RSA',
        n: 'sXch3mFgPOXDjOxP_cKL-1E5',
        e: 'AQAB'
      };

      const result = JWTValidationService.jwkToPem(jwk);

      expect(result).toContain('-----BEGIN PUBLIC KEY-----');
      expect(result).toContain('-----END PUBLIC KEY-----');
    });

    it('should throw for non-RSA key types', () => {
      const jwk = {
        kty: 'EC',
        crv: 'P-256',
        x: 'abc',
        y: 'def'
      };

      expect(() => JWTValidationService.jwkToPem(jwk))
        .toThrow('Unsupported key type: EC');
    });
  });

  describe('verifySignature', () => {
    it('should return false for invalid token format', () => {
      const result = JWTValidationService.verifySignature('invalid-token', {});
      expect(result).toBe(false);
    });

    it('should return false for token with wrong number of parts', () => {
      const result = JWTValidationService.verifySignature('a.b', {});
      expect(result).toBe(false);
    });
  });

  describe('validateClaims', () => {
    it('should validate matching issuer', () => {
      const payload = { iss: 'https://issuer.example.com' };
      const expectedClaims = { iss: 'https://issuer.example.com' };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should normalize issuer with trailing slash', () => {
      const payload = { iss: 'https://issuer.example.com/' };
      const expectedClaims = { iss: 'https://issuer.example.com' };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid issuer', () => {
      const payload = { iss: 'https://wrong.example.com' };
      const expectedClaims = { iss: 'https://issuer.example.com' };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid issuer'))).toBe(true);
    });

    it('should validate audience as array', () => {
      const payload = { aud: ['client1', 'client2'] };
      const expectedClaims = { aud: 'client1' };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(true);
    });

    it('should validate audience as string', () => {
      const payload = { aud: 'client1' };
      const expectedClaims = { aud: ['client1', 'client2'] };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid audience', () => {
      const payload = { aud: 'wrong-client' };
      const expectedClaims = { aud: 'expected-client' };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid audience'))).toBe(true);
    });

    it('should reject expired token', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = { exp: now - 3600 }; // Expired 1 hour ago

      const result = JWTValidationService.validateClaims(payload, {});

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Token expired'))).toBe(true);
    });

    it('should accept token within clock skew', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = { exp: now - 30 }; // Expired 30 seconds ago (within 60s skew)

      const result = JWTValidationService.validateClaims(payload, {});

      expect(result.valid).toBe(true);
    });

    it('should reject token not yet valid (nbf)', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = { nbf: now + 3600 }; // Valid in 1 hour

      const result = JWTValidationService.validateClaims(payload, {});

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Token not valid until'))).toBe(true);
    });

    it('should reject token issued in the future', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = { iat: now + 3600 }; // Issued in 1 hour

      const result = JWTValidationService.validateClaims(payload, {});

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Token issued in the future'))).toBe(true);
    });

    it('should validate nonce', () => {
      const payload = { nonce: 'abc123' };
      const expectedClaims = { nonce: 'abc123' };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid nonce', () => {
      const payload = { nonce: 'wrong-nonce' };
      const expectedClaims = { nonce: 'expected-nonce' };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid nonce');
    });

    it('should validate authorized party (azp)', () => {
      const payload = { azp: 'client-id' };
      const expectedClaims = { azp: 'client-id' };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid azp', () => {
      const payload = { azp: 'wrong-client' };
      const expectedClaims = { azp: 'expected-client' };

      const result = JWTValidationService.validateClaims(payload, expectedClaims);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid authorized party'))).toBe(true);
    });
  });

  describe('decodeToken', () => {
    it('should decode valid JWT', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: '123', email: 'test@test.com' })).toString('base64url');
      const signature = 'signature';
      const token = `${header}.${payload}.${signature}`;

      const result = JWTValidationService.decodeToken(token);

      expect(result.header).toEqual({ alg: 'RS256', typ: 'JWT' });
      expect(result.payload).toEqual({ sub: '123', email: 'test@test.com' });
      expect(result.signature).toBe('signature');
    });

    it('should throw for invalid JWT format', () => {
      expect(() => JWTValidationService.decodeToken('invalid'))
        .toThrow('Invalid JWT format');
    });

    it('should throw for token with two parts', () => {
      expect(() => JWTValidationService.decodeToken('a.b'))
        .toThrow('Invalid JWT format');
    });

    it('should throw for invalid base64 encoding', () => {
      expect(() => JWTValidationService.decodeToken('!!!.!!!.!!!'))
        .toThrow('Failed to decode JWT');
    });
  });

  describe('validateToken', () => {
    it('should reject unsupported algorithm', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: '123' })).toString('base64url');
      const token = `${header}.${payload}.signature`;

      const result = await JWTValidationService.validateToken(token, {
        algorithms: ['RS256']
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unsupported algorithm: HS256');
    });

    it('should validate token without JWKS verification', async () => {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: '123',
        iss: 'https://issuer.example.com',
        aud: 'client-id',
        exp: now + 3600
      })).toString('base64url');
      const token = `${header}.${payload}.signature`;

      const result = await JWTValidationService.validateToken(token, {
        issuer: 'https://issuer.example.com',
        audience: 'client-id'
      });

      expect(result.valid).toBe(true);
      expect(result.payload.sub).toBe('123');
    });

    it('should return validation errors for invalid claims', async () => {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: '123',
        iss: 'wrong-issuer',
        exp: now - 3600
      })).toString('base64url');
      const token = `${header}.${payload}.signature`;

      const result = await JWTValidationService.validateToken(token, {
        issuer: 'expected-issuer'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle decode errors', async () => {
      const result = await JWTValidationService.validateToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.payload).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear specific issuer cache', () => {
      JWTValidationService.cacheJWKS('issuer1', [{ kid: 'key1' }]);
      JWTValidationService.cacheJWKS('issuer2', [{ kid: 'key2' }]);

      JWTValidationService.clearCache('issuer1');

      expect(JWTValidationService.getCachedJWKS('issuer1')).toBeNull();
      expect(JWTValidationService.getCachedJWKS('issuer2')).not.toBeNull();
    });

    it('should clear all cache when no issuer specified', () => {
      JWTValidationService.cacheJWKS('issuer1', [{ kid: 'key1' }]);
      JWTValidationService.cacheJWKS('issuer2', [{ kid: 'key2' }]);

      JWTValidationService.clearCache();

      expect(JWTValidationService.getCachedJWKS('issuer1')).toBeNull();
      expect(JWTValidationService.getCachedJWKS('issuer2')).toBeNull();
    });
  });

  describe('getSigningKey', () => {
    it('should use cached JWKS if available', async () => {
      const keys = [{ kid: 'key1', kty: 'RSA', n: 'abc', e: 'AQAB' }];
      JWTValidationService.cacheJWKS('issuer1', keys);

      const result = await JWTValidationService.getSigningKey('key1', 'https://example.com/jwks', 'issuer1');

      expect(result).toEqual(keys[0]);
      expect(https.request).not.toHaveBeenCalled();
    });

    it('should return first signing key if kid not found', async () => {
      const keys = [
        { kid: 'key1', kty: 'RSA', use: 'sig' },
        { kid: 'key2', kty: 'RSA' }
      ];
      JWTValidationService.cacheJWKS('issuer1', keys);

      // Mock the JWKS fetch for when it tries to refresh (kid not found triggers refresh)
      const mockResponse = {
        on: jest.fn((event, callback) => {
          if (event === 'data') callback(JSON.stringify({ keys }));
          if (event === 'end') callback();
          return mockResponse;
        })
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await JWTValidationService.getSigningKey('unknown-kid', 'https://example.com/jwks', 'issuer1');

      expect(result).toEqual(keys[0]);
    });
  });
});

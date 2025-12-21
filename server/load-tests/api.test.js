/**
 * K6 Load Testing for BotBuilder API
 *
 * Installation:
 *   - Download k6 from https://k6.io/docs/get-started/installation/
 *   - Or: choco install k6 (Windows)
 *   - Or: brew install k6 (macOS)
 *
 * Usage:
 *   k6 run server/load-tests/api.test.js
 *   k6 run --vus 100 --duration 30s server/load-tests/api.test.js
 *
 * Environment:
 *   K6_BASE_URL=http://localhost:5000 k6 run server/load-tests/api.test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const botsDuration = new Trend('bots_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 200 },  // Ramp up to 200 users
    { duration: '1m', target: 200 },   // Stay at 200 users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be below 1%
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:5000';

// Test data
const testUser = {
  email: 'loadtest@example.com',
  password: 'LoadTest123!',
};

// Helper function to get auth token
function getAuthToken() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(testUser), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return body.token;
  }
  return null;
}

export function setup() {
  // Create test user if not exists (one-time setup)
  console.log('Setting up load test...');
  console.log(`Base URL: ${BASE_URL}`);

  // Try to register test user
  http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    username: 'loadtestuser',
    email: testUser.email,
    password: testUser.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  return { token: getAuthToken() };
}

export default function(data) {
  const token = data.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // ═══════════════════════════════════════════
  // Test 1: Health Check (1000 VU capable)
  // ═══════════════════════════════════════════
  group('Health Check', function() {
    const res = http.get(`${BASE_URL}/api/health`);

    const success = check(res, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });

    errorRate.add(!success);
    sleep(0.1);
  });

  // ═══════════════════════════════════════════
  // Test 2: Authentication (500 VU)
  // ═══════════════════════════════════════════
  group('Authentication', function() {
    const startTime = Date.now();

    const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(testUser), {
      headers: { 'Content-Type': 'application/json' },
    });

    loginDuration.add(Date.now() - startTime);

    const success = check(res, {
      'login status is 200': (r) => r.status === 200,
      'login has token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.token !== undefined;
        } catch (e) {
          return false;
        }
      },
      'login response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!success);
    sleep(0.5);
  });

  // ═══════════════════════════════════════════
  // Test 3: Get Bots List (500 VU)
  // ═══════════════════════════════════════════
  group('Bots API', function() {
    if (!token) {
      console.log('Skipping bots test - no auth token');
      return;
    }

    const startTime = Date.now();

    const res = http.get(`${BASE_URL}/api/bots`, {
      headers: authHeaders,
    });

    botsDuration.add(Date.now() - startTime);

    const success = check(res, {
      'bots status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'bots response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!success);
    sleep(0.3);
  });

  // ═══════════════════════════════════════════
  // Test 4: Organizations API
  // ═══════════════════════════════════════════
  group('Organizations API', function() {
    if (!token) return;

    const res = http.get(`${BASE_URL}/api/organizations`, {
      headers: authHeaders,
    });

    const success = check(res, {
      'organizations status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'organizations response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!success);
    sleep(0.2);
  });

  // ═══════════════════════════════════════════
  // Test 5: Knowledge Base API
  // ═══════════════════════════════════════════
  group('Knowledge Base API', function() {
    if (!token) return;

    const res = http.get(`${BASE_URL}/api/knowledge`, {
      headers: authHeaders,
    });

    const success = check(res, {
      'knowledge status is 200 or 401 or 404': (r) => [200, 401, 404].includes(r.status),
      'knowledge response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!success);
    sleep(0.2);
  });

  // Random sleep between iterations
  sleep(Math.random() * 2);
}

export function teardown(data) {
  console.log('Load test completed.');
  console.log('Check the results above for performance metrics.');
}

// ═══════════════════════════════════════════
// Smoke Test (Quick validation)
// ═══════════════════════════════════════════
export function smokeTest() {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    'smoke test passed': (r) => r.status === 200,
  });
}

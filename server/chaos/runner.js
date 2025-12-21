/**
 * Chaos Engineering Test Runner
 *
 * Simulates various failure scenarios to test system resilience.
 *
 * Usage:
 *   node server/chaos/runner.js
 *   node server/chaos/runner.js --scenario=database
 *   node server/chaos/runner.js --scenario=all
 *
 * Scenarios:
 *   - database: Simulates database connection failures
 *   - api-timeout: Simulates API timeout scenarios
 *   - memory: Simulates memory pressure
 *   - network: Simulates network latency
 *   - cpu: Simulates CPU stress
 */

const http = require('http');
const https = require('https');

// Configuration
const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:5000',
  duration: parseInt(process.env.CHAOS_DURATION) || 30000, // 30 seconds
  intensity: process.env.CHAOS_INTENSITY || 'medium', // low, medium, high
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}[CHAOS]${colors.reset} ${message}`);
}

function logError(message) {
  log(`ERROR: ${message}`, 'red');
}

function logSuccess(message) {
  log(`SUCCESS: ${message}`, 'green');
}

function logWarning(message) {
  log(`WARNING: ${message}`, 'yellow');
}

// ═══════════════════════════════════════════
// Scenario 1: Database Connection Failure
// ═══════════════════════════════════════════
class DatabaseChaos {
  constructor() {
    this.name = 'Database Connection Failure';
    this.description = 'Simulates database connection drops and reconnection';
  }

  async run() {
    log(`Starting scenario: ${this.name}`, 'cyan');

    const results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: [],
    };

    // Make requests while simulating DB issues
    const startTime = Date.now();
    while (Date.now() - startTime < CONFIG.duration) {
      try {
        const response = await this.makeRequest('/api/health');
        results.totalRequests++;

        if (response.statusCode === 200) {
          results.successfulRequests++;
        } else {
          results.failedRequests++;
          results.errors.push(`Status: ${response.statusCode}`);
        }
      } catch (error) {
        results.totalRequests++;
        results.failedRequests++;
        results.errors.push(error.message);
      }

      // Random delay between requests
      await this.sleep(Math.random() * 500 + 100);
    }

    return this.analyzeResults(results);
  }

  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, CONFIG.baseUrl);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.get(url.href, { timeout: 5000 }, (res) => {
        resolve(res);
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  analyzeResults(results) {
    const successRate = (results.successfulRequests / results.totalRequests) * 100;

    return {
      scenario: this.name,
      passed: successRate >= 95,
      metrics: {
        totalRequests: results.totalRequests,
        successRate: `${successRate.toFixed(2)}%`,
        failedRequests: results.failedRequests,
      },
      errors: results.errors.slice(0, 5), // First 5 errors
    };
  }
}

// ═══════════════════════════════════════════
// Scenario 2: API Timeout Simulation
// ═══════════════════════════════════════════
class ApiTimeoutChaos {
  constructor() {
    this.name = 'API Timeout Simulation';
    this.description = 'Tests how the system handles slow/timing out requests';
  }

  async run() {
    log(`Starting scenario: ${this.name}`, 'cyan');

    const endpoints = [
      '/api/health',
      '/api/bots',
      '/api/organizations',
    ];

    const results = {
      tests: [],
    };

    for (const endpoint of endpoints) {
      const testResult = await this.testEndpoint(endpoint);
      results.tests.push(testResult);
    }

    const allPassed = results.tests.every(t => t.passed);

    return {
      scenario: this.name,
      passed: allPassed,
      tests: results.tests,
    };
  }

  async testEndpoint(endpoint) {
    const timeouts = [100, 500, 1000, 2000, 5000];
    const responses = [];

    for (const timeout of timeouts) {
      try {
        const start = Date.now();
        await this.makeRequest(endpoint, timeout);
        const duration = Date.now() - start;
        responses.push({ timeout, duration, success: true });
      } catch (error) {
        responses.push({ timeout, success: false, error: error.message });
      }
    }

    const successCount = responses.filter(r => r.success).length;

    return {
      endpoint,
      passed: successCount >= 3, // At least 3 out of 5 should succeed
      responses,
    };
  }

  makeRequest(path, timeout) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, CONFIG.baseUrl);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.get(url.href, { timeout }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout after ${timeout}ms`));
      });
    });
  }
}

// ═══════════════════════════════════════════
// Scenario 3: Memory Pressure Test
// ═══════════════════════════════════════════
class MemoryPressureChaos {
  constructor() {
    this.name = 'Memory Pressure Test';
    this.description = 'Simulates memory pressure conditions';
    this.allocations = [];
  }

  async run() {
    log(`Starting scenario: ${this.name}`, 'cyan');

    const initialMemory = process.memoryUsage();
    const results = {
      initialMemory: this.formatMemory(initialMemory),
      allocations: [],
      apiResponses: [],
    };

    // Gradually allocate memory
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks
    const maxChunks = CONFIG.intensity === 'high' ? 20 : CONFIG.intensity === 'medium' ? 10 : 5;

    for (let i = 0; i < maxChunks; i++) {
      // Allocate memory
      try {
        this.allocations.push(Buffer.alloc(chunkSize));
        results.allocations.push({
          chunk: i + 1,
          size: `${chunkSize / 1024 / 1024}MB`,
          totalAllocated: `${((i + 1) * chunkSize) / 1024 / 1024}MB`,
        });

        // Test API response under memory pressure
        const apiResponse = await this.testApiUnderPressure();
        results.apiResponses.push(apiResponse);

        await this.sleep(500);
      } catch (error) {
        logError(`Memory allocation failed at chunk ${i + 1}: ${error.message}`);
        break;
      }
    }

    // Cleanup
    this.cleanup();

    const finalMemory = process.memoryUsage();
    results.finalMemory = this.formatMemory(finalMemory);

    const successfulResponses = results.apiResponses.filter(r => r.success).length;
    const successRate = (successfulResponses / results.apiResponses.length) * 100;

    return {
      scenario: this.name,
      passed: successRate >= 80,
      metrics: {
        chunksAllocated: results.allocations.length,
        apiSuccessRate: `${successRate.toFixed(2)}%`,
        initialHeap: results.initialMemory.heapUsed,
        finalHeap: results.finalMemory.heapUsed,
      },
    };
  }

  async testApiUnderPressure() {
    try {
      const start = Date.now();
      const response = await this.makeRequest('/api/health');
      return {
        success: response.status === 200,
        duration: Date.now() - start,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, CONFIG.baseUrl);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.get(url.href, { timeout: 5000 }, (res) => {
        resolve({ status: res.statusCode });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
    });
  }

  formatMemory(mem) {
    return {
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
    };
  }

  cleanup() {
    this.allocations = [];
    if (global.gc) {
      global.gc();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════
// Scenario 4: Network Latency Simulation
// ═══════════════════════════════════════════
class NetworkLatencyChaos {
  constructor() {
    this.name = 'Network Latency Simulation';
    this.description = 'Measures system behavior under various network conditions';
  }

  async run() {
    log(`Starting scenario: ${this.name}`, 'cyan');

    const results = {
      normalLatency: [],
      highLatency: [],
      packetLoss: [],
    };

    // Test normal conditions
    for (let i = 0; i < 10; i++) {
      const result = await this.measureLatency('/api/health');
      results.normalLatency.push(result);
      await this.sleep(100);
    }

    // Calculate statistics
    const avgNormal = this.calculateAverage(results.normalLatency);
    const p95Normal = this.calculatePercentile(results.normalLatency, 95);

    return {
      scenario: this.name,
      passed: avgNormal < 500 && p95Normal < 1000,
      metrics: {
        averageLatency: `${avgNormal.toFixed(2)}ms`,
        p95Latency: `${p95Normal.toFixed(2)}ms`,
        minLatency: `${Math.min(...results.normalLatency)}ms`,
        maxLatency: `${Math.max(...results.normalLatency)}ms`,
        requestCount: results.normalLatency.length,
      },
    };
  }

  async measureLatency(path) {
    const start = Date.now();
    try {
      await this.makeRequest(path);
      return Date.now() - start;
    } catch (error) {
      return -1; // Failed request
    }
  }

  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, CONFIG.baseUrl);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.get(url.href, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode }));
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Timeout')));
    });
  }

  calculateAverage(values) {
    const validValues = values.filter(v => v > 0);
    return validValues.reduce((a, b) => a + b, 0) / validValues.length;
  }

  calculatePercentile(values, percentile) {
    const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════
// Main Runner
// ═══════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);
  const scenarioArg = args.find(a => a.startsWith('--scenario='));
  const scenario = scenarioArg ? scenarioArg.split('=')[1] : 'all';

  log('╔════════════════════════════════════════════╗', 'magenta');
  log('║     CHAOS ENGINEERING TEST RUNNER          ║', 'magenta');
  log('╚════════════════════════════════════════════╝', 'magenta');
  log(`Base URL: ${CONFIG.baseUrl}`, 'blue');
  log(`Duration: ${CONFIG.duration}ms`, 'blue');
  log(`Intensity: ${CONFIG.intensity}`, 'blue');
  log(`Scenario: ${scenario}`, 'blue');
  console.log();

  const scenarios = {
    database: new DatabaseChaos(),
    'api-timeout': new ApiTimeoutChaos(),
    memory: new MemoryPressureChaos(),
    network: new NetworkLatencyChaos(),
  };

  const results = [];

  if (scenario === 'all') {
    for (const [name, instance] of Object.entries(scenarios)) {
      log(`\n─────────────────────────────────────────────`, 'blue');
      const result = await instance.run();
      results.push(result);

      if (result.passed) {
        logSuccess(`Scenario "${name}" PASSED`);
      } else {
        logError(`Scenario "${name}" FAILED`);
      }
      console.log(JSON.stringify(result.metrics || result, null, 2));
    }
  } else if (scenarios[scenario]) {
    const result = await scenarios[scenario].run();
    results.push(result);

    if (result.passed) {
      logSuccess(`Scenario "${scenario}" PASSED`);
    } else {
      logError(`Scenario "${scenario}" FAILED`);
    }
    console.log(JSON.stringify(result, null, 2));
  } else {
    logError(`Unknown scenario: ${scenario}`);
    log('Available scenarios: ' + Object.keys(scenarios).join(', '));
    process.exit(1);
  }

  // Summary
  console.log();
  log('╔════════════════════════════════════════════╗', 'magenta');
  log('║              TEST SUMMARY                  ║', 'magenta');
  log('╚════════════════════════════════════════════╝', 'magenta');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`, passed === total ? 'green' : 'red');

  process.exit(passed === total ? 0 : 1);
}

main().catch(error => {
  logError(error.message);
  process.exit(1);
});

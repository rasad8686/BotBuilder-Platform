/**
 * A/B Test Service
 *
 * Handles A/B testing for model versions:
 * - Create and manage A/B tests
 * - Record and analyze test results
 * - Calculate statistical significance
 * - Determine winners
 */

const db = require('../db');
const log = require('../utils/logger');

/**
 * Create a new A/B test
 * @param {Object} data - Test configuration
 * @returns {Promise<Object>} - Created test
 */
async function createABTest(data) {
  try {
    const result = await db.query(
      `INSERT INTO ab_tests (
        organization_id, name, description,
        model_a_version_id, model_b_version_id,
        traffic_split, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.organization_id || null,
        data.name,
        data.description || null,
        data.model_a_version_id,
        data.model_b_version_id,
        data.traffic_split || 50,
        'draft',
        data.created_by || null
      ]
    );

    log.info('A/B test created', { testId: result.rows[0].id, name: data.name });

    return result.rows[0];
  } catch (err) {
    log.error('Failed to create A/B test', { error: err.message });
    throw err;
  }
}

/**
 * Get all A/B tests
 * @param {number} organizationId - Optional organization filter
 * @returns {Promise<Array>} - List of tests
 */
async function getABTests(organizationId = null) {
  let query = `
    SELECT
      t.*,
      va.version_number as version_a_number,
      vb.version_number as version_b_number,
      ma.name as model_a_name,
      mb.name as model_b_name,
      vw.version_number as winner_version_number,
      (SELECT COUNT(*) FROM ab_test_results WHERE ab_test_id = t.id) as total_results
    FROM ab_tests t
    LEFT JOIN model_versions va ON t.model_a_version_id = va.id
    LEFT JOIN model_versions vb ON t.model_b_version_id = vb.id
    LEFT JOIN fine_tune_models ma ON va.fine_tune_model_id = ma.id
    LEFT JOIN fine_tune_models mb ON vb.fine_tune_model_id = mb.id
    LEFT JOIN model_versions vw ON t.winner_version_id = vw.id
  `;

  const params = [];
  if (organizationId) {
    query += ' WHERE t.organization_id = $1';
    params.push(organizationId);
  }

  query += ' ORDER BY t.created_at DESC';

  const result = await db.query(query, params);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    modelAVersionId: row.model_a_version_id,
    modelBVersionId: row.model_b_version_id,
    versionANumber: row.version_a_number,
    versionBNumber: row.version_b_number,
    modelAName: row.model_a_name,
    modelBName: row.model_b_name,
    trafficSplit: row.traffic_split,
    status: row.status,
    winnerVersionId: row.winner_version_id,
    winnerVersionNumber: row.winner_version_number,
    totalRequests: row.total_requests,
    totalResults: parseInt(row.total_results) || 0,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at
  }));
}

/**
 * Get a single A/B test by ID
 * @param {number} testId - Test ID
 * @returns {Promise<Object|null>} - Test or null
 */
async function getABTest(testId) {
  const result = await db.query(
    `SELECT
      t.*,
      va.version_number as version_a_number,
      va.openai_model_id as version_a_openai_id,
      vb.version_number as version_b_number,
      vb.openai_model_id as version_b_openai_id,
      ma.name as model_a_name,
      mb.name as model_b_name,
      vw.version_number as winner_version_number
     FROM ab_tests t
     LEFT JOIN model_versions va ON t.model_a_version_id = va.id
     LEFT JOIN model_versions vb ON t.model_b_version_id = vb.id
     LEFT JOIN fine_tune_models ma ON va.fine_tune_model_id = ma.id
     LEFT JOIN fine_tune_models mb ON vb.fine_tune_model_id = mb.id
     LEFT JOIN model_versions vw ON t.winner_version_id = vw.id
     WHERE t.id = $1`,
    [testId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    modelAVersionId: row.model_a_version_id,
    modelBVersionId: row.model_b_version_id,
    versionANumber: row.version_a_number,
    versionBNumber: row.version_b_number,
    versionAOpenaiId: row.version_a_openai_id,
    versionBOpenaiId: row.version_b_openai_id,
    modelAName: row.model_a_name,
    modelBName: row.model_b_name,
    trafficSplit: row.traffic_split,
    status: row.status,
    winnerVersionId: row.winner_version_id,
    winnerVersionNumber: row.winner_version_number,
    totalRequests: row.total_requests,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at
  };
}

/**
 * Update an A/B test
 * @param {number} testId - Test ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} - Updated test
 */
async function updateABTest(testId, data) {
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.traffic_split !== undefined) {
    updates.push(`traffic_split = $${paramIndex++}`);
    values.push(data.traffic_split);
  }

  if (updates.length === 0) {
    return getABTest(testId);
  }

  values.push(testId);

  const result = await db.query(
    `UPDATE ab_tests SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND status = 'draft'
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error('Test not found or cannot be modified');
  }

  return result.rows[0];
}

/**
 * Start an A/B test
 * @param {number} testId - Test ID
 * @returns {Promise<Object>} - Updated test
 */
async function startTest(testId) {
  const result = await db.query(
    `UPDATE ab_tests
     SET status = 'running', started_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'draft'
     RETURNING *`,
    [testId]
  );

  if (result.rows.length === 0) {
    throw new Error('Test not found or already started');
  }

  log.info('A/B test started', { testId });

  return result.rows[0];
}

/**
 * Stop an A/B test
 * @param {number} testId - Test ID
 * @returns {Promise<Object>} - Updated test
 */
async function stopTest(testId) {
  const result = await db.query(
    `UPDATE ab_tests
     SET status = 'completed', ended_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'running'
     RETURNING *`,
    [testId]
  );

  if (result.rows.length === 0) {
    throw new Error('Test not found or not running');
  }

  log.info('A/B test stopped', { testId });

  return result.rows[0];
}

/**
 * Cancel an A/B test
 * @param {number} testId - Test ID
 * @returns {Promise<Object>} - Updated test
 */
async function cancelTest(testId) {
  const result = await db.query(
    `UPDATE ab_tests
     SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status IN ('draft', 'running')
     RETURNING *`,
    [testId]
  );

  if (result.rows.length === 0) {
    throw new Error('Test not found or cannot be cancelled');
  }

  log.info('A/B test cancelled', { testId });

  return result.rows[0];
}

/**
 * Record a test result
 * @param {number} testId - Test ID
 * @param {number} versionId - Version that was used
 * @param {Object} data - Result data
 * @returns {Promise<Object>} - Created result
 */
async function recordTestResult(testId, versionId, data) {
  const result = await db.query(
    `INSERT INTO ab_test_results (
      ab_test_id, version_id, prompt, response,
      response_time_ms, tokens_used, user_rating,
      is_preferred, session_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      testId,
      versionId,
      data.prompt,
      data.response || null,
      data.response_time_ms || null,
      data.tokens_used || 0,
      data.user_rating || null,
      data.is_preferred || null,
      data.session_id || null,
      JSON.stringify(data.metadata || {})
    ]
  );

  // Update total requests count
  await db.query(
    `UPDATE ab_tests SET total_requests = total_requests + 1
     WHERE id = $1`,
    [testId]
  );

  return result.rows[0];
}

/**
 * Update user feedback on a test result
 * @param {number} resultId - Result ID
 * @param {Object} feedback - Feedback data
 * @returns {Promise<Object>} - Updated result
 */
async function updateResultFeedback(resultId, feedback) {
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (feedback.user_rating !== undefined) {
    updates.push(`user_rating = $${paramIndex++}`);
    values.push(feedback.user_rating);
  }
  if (feedback.is_preferred !== undefined) {
    updates.push(`is_preferred = $${paramIndex++}`);
    values.push(feedback.is_preferred);
  }

  if (updates.length === 0) return null;

  values.push(resultId);

  const result = await db.query(
    `UPDATE ab_test_results SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Get test results with statistics
 * @param {number} testId - Test ID
 * @returns {Promise<Object>} - Results and statistics
 */
async function getTestResults(testId) {
  // Get the test details
  const test = await getABTest(testId);
  if (!test) {
    throw new Error('Test not found');
  }

  // Get statistics for version A
  const statsA = await db.query(
    `SELECT
      COUNT(*) as total_requests,
      AVG(response_time_ms) as avg_response_time,
      AVG(user_rating) FILTER (WHERE user_rating IS NOT NULL) as avg_rating,
      COUNT(*) FILTER (WHERE is_preferred = true) as preference_count,
      SUM(tokens_used) as total_tokens
     FROM ab_test_results
     WHERE ab_test_id = $1 AND version_id = $2`,
    [testId, test.modelAVersionId]
  );

  // Get statistics for version B
  const statsB = await db.query(
    `SELECT
      COUNT(*) as total_requests,
      AVG(response_time_ms) as avg_response_time,
      AVG(user_rating) FILTER (WHERE user_rating IS NOT NULL) as avg_rating,
      COUNT(*) FILTER (WHERE is_preferred = true) as preference_count,
      SUM(tokens_used) as total_tokens
     FROM ab_test_results
     WHERE ab_test_id = $1 AND version_id = $2`,
    [testId, test.modelBVersionId]
  );

  // Get recent results
  const recentResults = await db.query(
    `SELECT r.*, v.version_number
     FROM ab_test_results r
     JOIN model_versions v ON r.version_id = v.id
     WHERE r.ab_test_id = $1
     ORDER BY r.created_at DESC
     LIMIT 50`,
    [testId]
  );

  const rowA = statsA.rows[0];
  const rowB = statsB.rows[0];

  return {
    test,
    versionA: {
      versionId: test.modelAVersionId,
      versionNumber: test.versionANumber,
      totalRequests: parseInt(rowA.total_requests) || 0,
      avgResponseTime: parseInt(rowA.avg_response_time) || null,
      avgRating: parseFloat(rowA.avg_rating) || null,
      preferenceCount: parseInt(rowA.preference_count) || 0,
      totalTokens: parseInt(rowA.total_tokens) || 0
    },
    versionB: {
      versionId: test.modelBVersionId,
      versionNumber: test.versionBNumber,
      totalRequests: parseInt(rowB.total_requests) || 0,
      avgResponseTime: parseInt(rowB.avg_response_time) || null,
      avgRating: parseFloat(rowB.avg_rating) || null,
      preferenceCount: parseInt(rowB.preference_count) || 0,
      totalTokens: parseInt(rowB.total_tokens) || 0
    },
    recentResults: recentResults.rows
  };
}

/**
 * Calculate the winner based on test results
 * @param {number} testId - Test ID
 * @returns {Promise<Object>} - Winner analysis
 */
async function calculateWinner(testId) {
  const results = await getTestResults(testId);

  const totalA = results.versionA.totalRequests;
  const totalB = results.versionB.totalRequests;
  const total = totalA + totalB;

  if (total < 30) {
    return {
      winner: null,
      confidence: 0,
      reason: 'Not enough data (minimum 30 requests required)',
      stats: results
    };
  }

  // Calculate scores based on multiple factors
  let scoreA = 0;
  let scoreB = 0;

  // Response time (lower is better)
  if (results.versionA.avgResponseTime && results.versionB.avgResponseTime) {
    if (results.versionA.avgResponseTime < results.versionB.avgResponseTime) {
      scoreA += 1;
    } else if (results.versionB.avgResponseTime < results.versionA.avgResponseTime) {
      scoreB += 1;
    }
  }

  // Average rating (higher is better)
  if (results.versionA.avgRating && results.versionB.avgRating) {
    if (results.versionA.avgRating > results.versionB.avgRating) {
      scoreA += 2;
    } else if (results.versionB.avgRating > results.versionA.avgRating) {
      scoreB += 2;
    }
  }

  // User preference (higher is better)
  const prefA = results.versionA.preferenceCount;
  const prefB = results.versionB.preferenceCount;
  const totalPref = prefA + prefB;

  if (totalPref > 0) {
    const prefRatioA = prefA / totalPref;
    const prefRatioB = prefB / totalPref;

    if (prefRatioA > 0.55) scoreA += 3;
    else if (prefRatioB > 0.55) scoreB += 3;
  }

  // Calculate confidence
  const maxScore = 6;
  const winningScore = Math.max(scoreA, scoreB);
  const confidence = Math.round((winningScore / maxScore) * 100);

  let winner = null;
  let winnerId = null;

  if (scoreA > scoreB) {
    winner = 'A';
    winnerId = results.test.modelAVersionId;
  } else if (scoreB > scoreA) {
    winner = 'B';
    winnerId = results.test.modelBVersionId;
  }

  return {
    winner,
    winnerId,
    confidence,
    scoreA,
    scoreB,
    reason: winner
      ? `Version ${winner} scored ${winningScore}/${maxScore} points`
      : 'Results are too close to declare a winner',
    stats: results
  };
}

/**
 * Declare a winner and end the test
 * @param {number} testId - Test ID
 * @param {number} winnerVersionId - Winner version ID (optional, auto-calculate if not provided)
 * @returns {Promise<Object>} - Updated test
 */
async function declareWinner(testId, winnerVersionId = null) {
  // If no winner specified, calculate it
  if (!winnerVersionId) {
    const analysis = await calculateWinner(testId);
    if (!analysis.winnerId) {
      throw new Error('Cannot determine winner: ' + analysis.reason);
    }
    winnerVersionId = analysis.winnerId;
  }

  const result = await db.query(
    `UPDATE ab_tests
     SET status = 'completed',
         winner_version_id = $1,
         ended_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [winnerVersionId, testId]
  );

  if (result.rows.length === 0) {
    throw new Error('Test not found');
  }

  log.info('A/B test winner declared', { testId, winnerVersionId });

  return result.rows[0];
}

/**
 * Select which version to use for a request based on traffic split
 * @param {number} testId - Test ID
 * @returns {Promise<Object>} - Selected version info
 */
async function selectVersionForRequest(testId) {
  const test = await getABTest(testId);

  if (!test || test.status !== 'running') {
    throw new Error('Test not found or not running');
  }

  // Random selection based on traffic split
  const random = Math.random() * 100;
  const useVersionA = random < test.trafficSplit;

  return {
    testId,
    selectedVersion: useVersionA ? 'A' : 'B',
    versionId: useVersionA ? test.modelAVersionId : test.modelBVersionId,
    openaiModelId: useVersionA ? test.versionAOpenaiId : test.versionBOpenaiId,
    versionNumber: useVersionA ? test.versionANumber : test.versionBNumber
  };
}

/**
 * Delete an A/B test
 * @param {number} testId - Test ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteABTest(testId) {
  const test = await getABTest(testId);
  if (!test) {
    throw new Error('Test not found');
  }

  if (test.status === 'running') {
    throw new Error('Cannot delete a running test');
  }

  await db.query('DELETE FROM ab_tests WHERE id = $1', [testId]);

  log.info('A/B test deleted', { testId });

  return true;
}

module.exports = {
  createABTest,
  getABTests,
  getABTest,
  updateABTest,
  startTest,
  stopTest,
  cancelTest,
  recordTestResult,
  updateResultFeedback,
  getTestResults,
  calculateWinner,
  declareWinner,
  selectVersionForRequest,
  deleteABTest
};

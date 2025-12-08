const db = require('../db');

class IntentConflictDetector {
  constructor() {
    this.defaultThreshold = 0.7;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    // Create matrix
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first column
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }

    // Initialize first row
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate similarity between two texts (0 to 1)
   */
  calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;

    // Normalize texts
    const normalized1 = text1.toLowerCase().trim();
    const normalized2 = text2.toLowerCase().trim();

    if (normalized1 === normalized2) return 1;

    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    if (maxLength === 0) return 1;

    return 1 - (distance / maxLength);
  }

  /**
   * Detect conflicts between intent examples
   */
  async detectConflicts(botId, organizationId, threshold = this.defaultThreshold) {
    // Get all intents with their examples
    const result = await db.query(
      `SELECT i.id as intent_id, i.name as intent_name, i.display_name,
              ie.id as example_id, ie.text as example_text
       FROM intents i
       JOIN intent_examples ie ON i.id = ie.intent_id
       WHERE i.bot_id = $1 AND i.organization_id = $2
       ORDER BY i.name, ie.id`,
      [botId, organizationId]
    );

    const examples = result.rows;
    const conflicts = [];

    // Compare each pair of examples from different intents
    for (let i = 0; i < examples.length; i++) {
      for (let j = i + 1; j < examples.length; j++) {
        const ex1 = examples[i];
        const ex2 = examples[j];

        // Skip if same intent
        if (ex1.intent_id === ex2.intent_id) continue;

        const similarity = this.calculateSimilarity(ex1.example_text, ex2.example_text);

        if (similarity >= threshold) {
          conflicts.push({
            intent1: {
              id: ex1.intent_id,
              name: ex1.intent_name,
              display_name: ex1.display_name,
              example_id: ex1.example_id,
              example: ex1.example_text
            },
            intent2: {
              id: ex2.intent_id,
              name: ex2.intent_name,
              display_name: ex2.display_name,
              example_id: ex2.example_id,
              example: ex2.example_text
            },
            similarity: Math.round(similarity * 100) / 100
          });
        }
      }
    }

    // Sort by similarity (highest first)
    conflicts.sort((a, b) => b.similarity - a.similarity);

    return conflicts;
  }

  /**
   * Get conflict report for a bot
   */
  async getConflictReport(botId, organizationId, threshold = this.defaultThreshold) {
    const conflicts = await this.detectConflicts(botId, organizationId, threshold);

    // Group conflicts by severity
    const critical = conflicts.filter(c => c.similarity >= 0.9);
    const high = conflicts.filter(c => c.similarity >= 0.8 && c.similarity < 0.9);
    const medium = conflicts.filter(c => c.similarity >= 0.7 && c.similarity < 0.8);

    // Find intents with most conflicts
    const intentConflictCounts = {};
    for (const conflict of conflicts) {
      intentConflictCounts[conflict.intent1.name] = (intentConflictCounts[conflict.intent1.name] || 0) + 1;
      intentConflictCounts[conflict.intent2.name] = (intentConflictCounts[conflict.intent2.name] || 0) + 1;
    }

    const problematicIntents = Object.entries(intentConflictCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, conflictCount: count }));

    return {
      conflicts,
      summary: {
        totalConflicts: conflicts.length,
        critical: critical.length,
        high: high.length,
        medium: medium.length
      },
      problematicIntents,
      threshold,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Resolve conflict by deleting one example
   */
  async resolveConflictByDelete(exampleId, organizationId) {
    // Verify example belongs to organization's intent
    const result = await db.query(
      `SELECT ie.id FROM intent_examples ie
       JOIN intents i ON ie.intent_id = i.id
       WHERE ie.id = $1 AND i.organization_id = $2`,
      [exampleId, organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Example not found or access denied');
    }

    await db.query('DELETE FROM intent_examples WHERE id = $1', [exampleId]);
    return { deleted: true, exampleId };
  }

  /**
   * Resolve conflict by moving example to different intent
   */
  async resolveConflictByMove(exampleId, newIntentId, organizationId) {
    // Verify example and new intent belong to organization
    const exampleCheck = await db.query(
      `SELECT ie.id, ie.text FROM intent_examples ie
       JOIN intents i ON ie.intent_id = i.id
       WHERE ie.id = $1 AND i.organization_id = $2`,
      [exampleId, organizationId]
    );

    if (exampleCheck.rows.length === 0) {
      throw new Error('Example not found or access denied');
    }

    const intentCheck = await db.query(
      'SELECT id FROM intents WHERE id = $1 AND organization_id = $2',
      [newIntentId, organizationId]
    );

    if (intentCheck.rows.length === 0) {
      throw new Error('Target intent not found or access denied');
    }

    await db.query(
      'UPDATE intent_examples SET intent_id = $1 WHERE id = $2',
      [newIntentId, exampleId]
    );

    return { moved: true, exampleId, newIntentId };
  }

  /**
   * Resolve conflict by merging intents
   */
  async resolveConflictByMerge(sourceIntentId, targetIntentId, organizationId) {
    // Verify both intents belong to organization
    const intentsCheck = await db.query(
      'SELECT id, name FROM intents WHERE id IN ($1, $2) AND organization_id = $3',
      [sourceIntentId, targetIntentId, organizationId]
    );

    if (intentsCheck.rows.length !== 2) {
      throw new Error('One or both intents not found or access denied');
    }

    // Move all examples from source to target
    await db.query(
      'UPDATE intent_examples SET intent_id = $1 WHERE intent_id = $2',
      [targetIntentId, sourceIntentId]
    );

    // Delete source intent
    await db.query('DELETE FROM intents WHERE id = $1', [sourceIntentId]);

    return { merged: true, sourceIntentId, targetIntentId };
  }

  /**
   * Find similar examples for a given text
   */
  async findSimilarExamples(botId, organizationId, text, threshold = 0.6, limit = 10) {
    const result = await db.query(
      `SELECT i.id as intent_id, i.name as intent_name, i.display_name,
              ie.id as example_id, ie.text as example_text
       FROM intents i
       JOIN intent_examples ie ON i.id = ie.intent_id
       WHERE i.bot_id = $1 AND i.organization_id = $2`,
      [botId, organizationId]
    );

    const similar = [];
    for (const row of result.rows) {
      const similarity = this.calculateSimilarity(text, row.example_text);
      if (similarity >= threshold) {
        similar.push({
          intentId: row.intent_id,
          intentName: row.intent_name,
          displayName: row.display_name,
          exampleId: row.example_id,
          exampleText: row.example_text,
          similarity: Math.round(similarity * 100) / 100
        });
      }
    }

    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}

module.exports = new IntentConflictDetector();

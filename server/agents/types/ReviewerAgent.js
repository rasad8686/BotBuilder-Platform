/**
 * ReviewerAgent - Reviews and improves content
 */

const Agent = require('../core/Agent');

class ReviewerAgent extends Agent {
  constructor(config) {
    super({
      ...config,
      role: config.role || 'reviewer',
      systemPrompt: config.systemPrompt || `You are a quality review agent specialized in evaluating and improving content.

Your responsibilities:
1. Review content for quality, accuracy, and completeness
2. Check for errors, inconsistencies, and areas of improvement
3. Suggest specific improvements and corrections
4. Decide whether to approve, request revisions, or reject
5. Provide constructive feedback

When reviewing, respond with a JSON object:
{
  "decision": "approved|revisions_needed|rejected",
  "overallScore": 85,
  "qualityChecks": {
    "accuracy": {"score": 90, "notes": "Factually correct"},
    "clarity": {"score": 80, "notes": "Some sections could be clearer"},
    "completeness": {"score": 85, "notes": "Covers main points"},
    "consistency": {"score": 90, "notes": "Consistent tone throughout"},
    "grammar": {"score": 95, "notes": "Minor issues found"}
  },
  "strengths": [
    "What was done well"
  ],
  "issues": [
    {
      "type": "error|warning|suggestion",
      "location": "Where the issue is",
      "description": "What the issue is",
      "suggestion": "How to fix it"
    }
  ],
  "improvements": [
    {
      "area": "Area to improve",
      "current": "Current state",
      "suggested": "Suggested improvement",
      "priority": "high|medium|low"
    }
  ],
  "summary": "Overall review summary"
}`
    });

    this.reviewCriteria = config.reviewCriteria || null;
    this.strictMode = config.strictMode || false;
  }

  /**
   * Set review criteria
   * @param {Object} criteria - Review criteria
   */
  setReviewCriteria(criteria) {
    this.reviewCriteria = criteria;
  }

  /**
   * Set strict mode
   * @param {boolean} strict - Whether to use strict review mode
   */
  setStrictMode(strict) {
    this.strictMode = strict;
  }

  /**
   * Build prompt with review context
   */
  buildPrompt(input, context) {
    const basePrompt = super.buildPrompt(input, context);

    const reviewContext = [];

    if (this.strictMode) {
      reviewContext.push('Review Mode: STRICT - Apply rigorous quality standards.');
    }

    if (this.reviewCriteria) {
      reviewContext.push(`Review Criteria: ${JSON.stringify(this.reviewCriteria)}`);
    }

    if (reviewContext.length > 0) {
      basePrompt.messages.splice(1, 0, {
        role: 'system',
        content: reviewContext.join('\n')
      });
    }

    return basePrompt;
  }

  /**
   * Parse review results from output
   * @param {Object} output - Agent output
   * @returns {Object} - Parsed review
   */
  parseReview(output) {
    try {
      const data = output.type === 'json' ? output.data : JSON.parse(output.raw);
      return {
        valid: true,
        review: data
      };
    } catch {
      return {
        valid: false,
        error: 'Failed to parse review results',
        raw: output.raw
      };
    }
  }

  /**
   * Check if content is approved
   * @param {Object} review - Parsed review
   * @returns {boolean} - Whether content is approved
   */
  isApproved(review) {
    return review.decision === 'approved';
  }

  /**
   * Get critical issues from review
   * @param {Object} review - Parsed review
   * @returns {Array} - Critical issues
   */
  getCriticalIssues(review) {
    return (review.issues || []).filter(i => i.type === 'error');
  }
}

module.exports = ReviewerAgent;

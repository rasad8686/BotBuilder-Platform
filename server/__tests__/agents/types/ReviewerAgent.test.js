/**
 * ReviewerAgent Tests
 * Tests for server/agents/types/ReviewerAgent.js
 */

jest.mock('openai', () => jest.fn());
jest.mock('@anthropic-ai/sdk', () => jest.fn());
jest.mock('../../../models/AgentTool', () => ({ findEnabledByAgentId: jest.fn() }));
jest.mock('../../../models/Tool', () => ({ findById: jest.fn() }));
jest.mock('../../../tools/types', () => ({ createTool: jest.fn() }));
jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const ReviewerAgent = require('../../../agents/types/ReviewerAgent');

describe('ReviewerAgent', () => {
  let reviewerAgent;

  beforeEach(() => {
    reviewerAgent = new ReviewerAgent({
      id: 1,
      name: 'QualityReviewer'
    });
  });

  describe('constructor', () => {
    it('should set default role to reviewer', () => {
      expect(reviewerAgent.role).toBe('reviewer');
    });

    it('should use custom role if provided', () => {
      const customAgent = new ReviewerAgent({
        id: 2,
        name: 'Custom',
        role: 'quality-checker'
      });

      expect(customAgent.role).toBe('quality-checker');
    });

    it('should set default system prompt', () => {
      expect(reviewerAgent.systemPrompt).toContain('quality review agent');
    });

    it('should use custom system prompt if provided', () => {
      const customAgent = new ReviewerAgent({
        id: 2,
        systemPrompt: 'Custom reviewer prompt'
      });

      expect(customAgent.systemPrompt).toBe('Custom reviewer prompt');
    });

    it('should initialize reviewCriteria as null', () => {
      expect(reviewerAgent.reviewCriteria).toBeNull();
    });

    it('should initialize strictMode as false', () => {
      expect(reviewerAgent.strictMode).toBe(false);
    });

    it('should accept custom reviewCriteria', () => {
      const agent = new ReviewerAgent({
        id: 1,
        reviewCriteria: { accuracy: 0.9 }
      });

      expect(agent.reviewCriteria).toEqual({ accuracy: 0.9 });
    });

    it('should accept custom strictMode', () => {
      const agent = new ReviewerAgent({
        id: 1,
        strictMode: true
      });

      expect(agent.strictMode).toBe(true);
    });
  });

  describe('setReviewCriteria', () => {
    it('should set review criteria', () => {
      reviewerAgent.setReviewCriteria({ minScore: 80 });

      expect(reviewerAgent.reviewCriteria).toEqual({ minScore: 80 });
    });
  });

  describe('setStrictMode', () => {
    it('should set strict mode', () => {
      reviewerAgent.setStrictMode(true);

      expect(reviewerAgent.strictMode).toBe(true);
    });

    it('should disable strict mode', () => {
      reviewerAgent.strictMode = true;
      reviewerAgent.setStrictMode(false);

      expect(reviewerAgent.strictMode).toBe(false);
    });
  });

  describe('buildPrompt', () => {
    it('should include strict mode in prompt when enabled', () => {
      reviewerAgent.setStrictMode(true);

      const prompt = reviewerAgent.buildPrompt('Review this', null);

      const strictMessage = prompt.messages.find(m =>
        m.content && m.content.includes('STRICT')
      );
      expect(strictMessage).toBeDefined();
    });

    it('should include review criteria in prompt when set', () => {
      reviewerAgent.setReviewCriteria({ quality: 'high' });

      const prompt = reviewerAgent.buildPrompt('Review this', null);

      const criteriaMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Review Criteria')
      );
      expect(criteriaMessage).toBeDefined();
    });

    it('should not add extra messages when no criteria or strict mode', () => {
      const prompt = reviewerAgent.buildPrompt('Review this', null);

      const extraMessages = prompt.messages.filter(m =>
        m.content && (m.content.includes('STRICT') || m.content.includes('Review Criteria'))
      );
      expect(extraMessages).toHaveLength(0);
    });
  });

  describe('parseReview', () => {
    it('should parse JSON output', () => {
      const output = {
        type: 'json',
        data: {
          decision: 'approved',
          overallScore: 90,
          summary: 'Good quality'
        }
      };

      const result = reviewerAgent.parseReview(output);

      expect(result.valid).toBe(true);
      expect(result.review.decision).toBe('approved');
      expect(result.review.overallScore).toBe(90);
    });

    it('should parse raw JSON string', () => {
      const output = {
        type: 'text',
        raw: '{"decision": "revisions_needed", "overallScore": 70}'
      };

      const result = reviewerAgent.parseReview(output);

      expect(result.valid).toBe(true);
      expect(result.review.decision).toBe('revisions_needed');
    });

    it('should handle parse errors', () => {
      const output = {
        type: 'text',
        raw: 'Not valid JSON'
      };

      const result = reviewerAgent.parseReview(output);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Failed to parse review results');
      expect(result.raw).toBe('Not valid JSON');
    });
  });

  describe('isApproved', () => {
    it('should return true for approved decision', () => {
      const review = { decision: 'approved' };

      expect(reviewerAgent.isApproved(review)).toBe(true);
    });

    it('should return false for revisions_needed decision', () => {
      const review = { decision: 'revisions_needed' };

      expect(reviewerAgent.isApproved(review)).toBe(false);
    });

    it('should return false for rejected decision', () => {
      const review = { decision: 'rejected' };

      expect(reviewerAgent.isApproved(review)).toBe(false);
    });
  });

  describe('getCriticalIssues', () => {
    it('should return only error type issues', () => {
      const review = {
        issues: [
          { type: 'error', description: 'Critical bug' },
          { type: 'warning', description: 'Minor issue' },
          { type: 'suggestion', description: 'Improvement' },
          { type: 'error', description: 'Another bug' }
        ]
      };

      const critical = reviewerAgent.getCriticalIssues(review);

      expect(critical).toHaveLength(2);
      expect(critical[0].description).toBe('Critical bug');
      expect(critical[1].description).toBe('Another bug');
    });

    it('should return empty array if no issues', () => {
      const review = {};

      const critical = reviewerAgent.getCriticalIssues(review);

      expect(critical).toEqual([]);
    });

    it('should return empty array if no error type issues', () => {
      const review = {
        issues: [
          { type: 'warning', description: 'Minor' },
          { type: 'suggestion', description: 'Nice to have' }
        ]
      };

      const critical = reviewerAgent.getCriticalIssues(review);

      expect(critical).toHaveLength(0);
    });
  });
});

/**
 * Check Message Limit Middleware Tests
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const { checkMessageLimit } = require('../../middleware/checkMessageLimit');

describe('checkMessageLimit middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      organization: { id: 1 }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('should skip if no organization', async () => {
    req.organization = null;

    await checkMessageLimit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('should return 404 if organization not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await checkMessageLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Organization not found'
    }));
  });

  it('should allow if unlimited messages', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ plan_tier: 'enterprise', max_messages_per_month: -1 }]
    });

    await checkMessageLimit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow if no limit set', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ plan_tier: 'custom', max_messages_per_month: null }]
    });

    await checkMessageLimit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow if under limit', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ plan_tier: 'basic', max_messages_per_month: 1000 }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: '500' }]
      });

    await checkMessageLimit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.messageUsage).toEqual({
      current: 500,
      limit: 1000,
      remaining: 500
    });
  });

  it('should return 429 if limit exceeded', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ plan_tier: 'starter', max_messages_per_month: 100 }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: '150' }]
      });

    await checkMessageLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Monthly message limit exceeded. Please upgrade your plan.',
      details: {
        current: 150,
        limit: 100,
        plan: 'starter'
      }
    }));
  });

  it('should return 429 if at limit', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ plan_tier: 'basic', max_messages_per_month: 500 }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: '500' }]
      });

    await checkMessageLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('should continue on error (fail open)', async () => {
    db.query.mockRejectedValue(new Error('Database error'));

    await checkMessageLimit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should handle zero messages', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ plan_tier: 'basic', max_messages_per_month: 1000 }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: '0' }]
      });

    await checkMessageLimit(req, res, next);

    expect(req.messageUsage.current).toBe(0);
    expect(req.messageUsage.remaining).toBe(1000);
    expect(next).toHaveBeenCalled();
  });
});

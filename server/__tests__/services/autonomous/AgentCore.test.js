/**
 * AgentCore Tests
 * Tests for core autonomous agent functionality
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../../db');
const AgentCore = require('../../../services/autonomous/AgentCore');

describe('AgentCore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an agent with minimal data', async () => {
      const mockAgent = {
        id: 'agent-1',
        user_id: 'user-1',
        name: 'Test Agent',
        description: null,
        capabilities: '[]',
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 4096,
        system_prompt: AgentCore.getDefaultSystemPrompt(),
        settings: '{}',
        created_at: new Date().toISOString()
      };

      db.query.mockResolvedValue({ rows: [mockAgent] });

      const result = await AgentCore.create('user-1', { name: 'Test Agent' });

      expect(result.id).toBe('agent-1');
      expect(result.name).toBe('Test Agent');
      expect(result.capabilities).toEqual([]);
      expect(result.settings).toEqual({});
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO autonomous_agents'),
        expect.arrayContaining(['user-1', 'Test Agent'])
      );
    });

    it('should create an agent with full data', async () => {
      const mockAgent = {
        id: 'agent-2',
        user_id: 'user-1',
        name: 'Full Agent',
        description: 'A comprehensive agent',
        capabilities: '["web_search", "email"]',
        model: 'gpt-4-turbo',
        temperature: 0.5,
        max_tokens: 8192,
        system_prompt: 'Custom prompt',
        settings: '{"maxRetries": 3}',
        created_at: new Date().toISOString()
      };

      db.query.mockResolvedValue({ rows: [mockAgent] });

      const result = await AgentCore.create('user-1', {
        name: 'Full Agent',
        description: 'A comprehensive agent',
        capabilities: ['web_search', 'email'],
        model: 'gpt-4-turbo',
        temperature: 0.5,
        max_tokens: 8192,
        system_prompt: 'Custom prompt',
        settings: { maxRetries: 3 }
      });

      expect(result.name).toBe('Full Agent');
      expect(result.capabilities).toEqual(['web_search', 'email']);
      expect(result.settings).toEqual({ maxRetries: 3 });
    });

    it('should throw error when name is missing', async () => {
      await expect(AgentCore.create('user-1', {})).rejects.toThrow('Agent name is required');
    });

    it('should throw error when name is empty', async () => {
      await expect(AgentCore.create('user-1', { name: '' })).rejects.toThrow('Agent name is required');
    });
  });

  describe('getDefaultSystemPrompt', () => {
    it('should return a default system prompt', () => {
      const prompt = AgentCore.getDefaultSystemPrompt();

      expect(prompt).toContain('autonomous AI agent');
      expect(prompt).toContain('THINK');
      expect(prompt).toContain('PLAN');
      expect(prompt).toContain('EXECUTE');
      expect(prompt).toContain('VERIFY');
      expect(prompt).toContain('COMPLETE');
    });
  });

  describe('findById', () => {
    it('should find an agent by ID', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        capabilities: '["search"]',
        settings: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockAgent] });

      const result = await AgentCore.findById('agent-1');

      expect(result.id).toBe('agent-1');
      expect(result.capabilities).toEqual(['search']);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM autonomous_agents WHERE id = $1'),
        ['agent-1']
      );
    });

    it('should return null when agent not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await AgentCore.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should find all agents for a user', async () => {
      const mockAgents = [
        { id: 'agent-1', name: 'Agent 1', capabilities: '[]', settings: '{}' },
        { id: 'agent-2', name: 'Agent 2', capabilities: '["email"]', settings: '{}' }
      ];

      db.query.mockResolvedValue({ rows: mockAgents });

      const result = await AgentCore.findByUser('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('agent-1');
      expect(result[1].capabilities).toEqual(['email']);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await AgentCore.findByUser('user-1', { status: 'active' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        expect.arrayContaining(['user-1', 'active'])
      );
    });

    it('should apply limit and offset', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await AgentCore.findByUser('user-1', { limit: 10, offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['user-1', 10, 20])
      );
    });

    it('should use default limit and offset', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await AgentCore.findByUser('user-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['user-1', 50, 0])
      );
    });
  });

  describe('update', () => {
    it('should update agent name', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Updated Agent',
        capabilities: '[]',
        settings: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockAgent] });

      const result = await AgentCore.update('agent-1', 'user-1', { name: 'Updated Agent' });

      expect(result.name).toBe('Updated Agent');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE autonomous_agents'),
        expect.arrayContaining(['Updated Agent', 'agent-1', 'user-1'])
      );
    });

    it('should update multiple fields', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Agent',
        description: 'New description',
        model: 'gpt-4-turbo',
        capabilities: '["email", "calendar"]',
        settings: '{"timeout": 60}'
      };

      db.query.mockResolvedValue({ rows: [mockAgent] });

      const result = await AgentCore.update('agent-1', 'user-1', {
        description: 'New description',
        model: 'gpt-4-turbo',
        capabilities: ['email', 'calendar'],
        settings: { timeout: 60 }
      });

      expect(result.description).toBe('New description');
      expect(result.capabilities).toEqual(['email', 'calendar']);
    });

    it('should throw error when no valid fields provided', async () => {
      await expect(AgentCore.update('agent-1', 'user-1', { invalid_field: 'value' }))
        .rejects.toThrow('No valid fields to update');
    });

    it('should throw error when agent not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(AgentCore.update('nonexistent', 'user-1', { name: 'Test' }))
        .rejects.toThrow('Agent not found or access denied');
    });

    it('should stringify capabilities when updating', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Agent',
        capabilities: '["email"]',
        settings: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockAgent] });

      await AgentCore.update('agent-1', 'user-1', { capabilities: ['email'] });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(['email'])])
      );
    });
  });

  describe('delete', () => {
    it('should delete an agent', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'agent-1' }] });

      const result = await AgentCore.delete('agent-1', 'user-1');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM autonomous_agents'),
        ['agent-1', 'user-1']
      );
    });

    it('should throw error when agent not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(AgentCore.delete('nonexistent', 'user-1'))
        .rejects.toThrow('Agent not found or access denied');
    });
  });

  describe('updateStats', () => {
    it('should update stats for successful task', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await AgentCore.updateStats('agent-1', true);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('total_tasks = total_tasks + 1'),
        ['agent-1']
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('successful_tasks = successful_tasks + 1'),
        expect.any(Array)
      );
    });

    it('should update stats for failed task', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await AgentCore.updateStats('agent-1', false);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('failed_tasks = failed_tasks + 1'),
        expect.any(Array)
      );
    });
  });

  describe('getStats', () => {
    it('should get agent statistics', async () => {
      const mockStats = {
        total_tasks: 100,
        successful_tasks: 90,
        failed_tasks: 10,
        success_rate: 90.00
      };

      db.query.mockResolvedValue({ rows: [mockStats] });

      const result = await AgentCore.getStats('agent-1');

      expect(result.total_tasks).toBe(100);
      expect(result.success_rate).toBe(90.00);
    });

    it('should return null when agent not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await AgentCore.getStats('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('parseAgent', () => {
    it('should parse JSON capabilities', () => {
      const row = {
        id: 'agent-1',
        capabilities: '["email", "search"]',
        settings: '{"key": "value"}'
      };

      const result = AgentCore.parseAgent(row);

      expect(result.capabilities).toEqual(['email', 'search']);
      expect(result.settings).toEqual({ key: 'value' });
    });

    it('should handle already parsed capabilities', () => {
      const row = {
        id: 'agent-1',
        capabilities: ['email', 'search'],
        settings: { key: 'value' }
      };

      const result = AgentCore.parseAgent(row);

      expect(result.capabilities).toEqual(['email', 'search']);
      expect(result.settings).toEqual({ key: 'value' });
    });

    it('should handle null/undefined capabilities', () => {
      const row = {
        id: 'agent-1',
        capabilities: null,
        settings: undefined
      };

      const result = AgentCore.parseAgent(row);

      expect(result.capabilities).toEqual([]);
      expect(result.settings).toEqual({});
    });

    it('should return null for null input', () => {
      expect(AgentCore.parseAgent(null)).toBeNull();
    });
  });

  describe('validateOwnership', () => {
    it('should return true when user owns agent', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'agent-1' }] });

      const result = await AgentCore.validateOwnership('agent-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when user does not own agent', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await AgentCore.validateOwnership('agent-1', 'other-user');

      expect(result).toBe(false);
    });
  });
});

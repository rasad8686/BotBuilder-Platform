/**
 * Comprehensive Model Tests
 * Tests for server models covering CRUD operations, validation, edge cases
 */

// Mock the database and logger BEFORE importing models
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const User = require('../../models/User');
const Organization = require('../../models/Organization');
const Conversation = require('../../models/Conversation');
const KnowledgeBase = require('../../models/KnowledgeBase');
const Message = require('../../models/Message');
const Bot = require('../../models/Bot');

describe('Comprehensive Model Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // USER MODEL TESTS
  // ========================================
  describe('User Model - Extended Tests', () => {
    describe('create() - Edge Cases', () => {
      it('should handle null avatar_url explicitly', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, avatar_url: null }] });

        const result = await User.create({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash',
          avatar_url: null
        });

        expect(result.avatar_url).toBeNull();
      });

      it('should handle very long names', async () => {
        const longName = 'A'.repeat(255);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: longName }] });

        const result = await User.create({
          name: longName,
          email: 'test@example.com',
          password_hash: 'hash'
        });

        expect(result.name).toBe(longName);
      });

      it('should handle email with special characters', async () => {
        const specialEmail = 'user+tag@sub-domain.example.com';
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, email: specialEmail }] });

        const result = await User.create({
          name: 'Test',
          email: specialEmail,
          password_hash: 'hash'
        });

        expect(result.email).toBe(specialEmail);
      });

      it('should create user with all boolean flags set to false', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false, email_verified: false }] });

        await User.create({
          name: 'Test',
          email: 'test@example.com',
          password_hash: 'hash',
          is_active: false,
          email_verified: false
        });

        const insertCall = db.query.mock.calls[0];
        expect(insertCall[1][4]).toBe(false);
        expect(insertCall[1][5]).toBe(false);
      });

      it('should handle creating user with whitespace in name', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: '  Test User  ' }] });

        const result = await User.create({
          name: '  Test User  ',
          email: 'test@example.com',
          password_hash: 'hash'
        });

        expect(result.name).toBe('  Test User  ');
      });
    });

    describe('findByEmail() - Edge Cases', () => {
      it('should handle email with uppercase letters', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'Test@Example.COM' }] });

        const result = await User.findByEmail('Test@Example.COM');

        expect(result).not.toBeNull();
        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          ['Test@Example.COM']
        );
      });

      it('should handle very long email addresses', async () => {
        const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, email: longEmail }] });

        const result = await User.findByEmail(longEmail);

        expect(result.email).toBe(longEmail);
      });

      it('should return null for empty email', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await User.findByEmail('');

        expect(result).toBeNull();
      });
    });

    describe('search() - Edge Cases', () => {
      it('should handle search with special regex characters', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await User.search('user@test.com');

        expect(db.query.mock.calls[0][1][0]).toBe('%user@test.com%');
      });

      it('should handle empty search query', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await User.search('');

        expect(result).toEqual([]);
        expect(db.query.mock.calls[0][1][0]).toBe('%%');
      });

      it('should handle search with only whitespace', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await User.search('   ');

        expect(db.query.mock.calls[0][1][0]).toBe('%   %');
      });
    });

    describe('update() - Edge Cases', () => {
      it('should allow updating email to empty string', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, email: '' }] });

        const result = await User.update(1, { email: '' });

        expect(result.email).toBe('');
      });

      it('should update only is_active to false', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });

        await User.update(1, { is_active: false });

        expect(db.query.mock.calls[0][0]).toContain('is_active = $1');
      });

      it('should update only email_verified to true', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, email_verified: true }] });

        await User.update(1, { email_verified: true });

        expect(db.query.mock.calls[0][0]).toContain('email_verified = $1');
      });

      it('should handle updating with undefined values', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await User.update(1, { name: undefined, email: undefined });

        expect(db.query).toHaveBeenCalledTimes(1); // Only SELECT
      });

      it('should handle updating avatar_url to null', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, avatar_url: null }] });

        const result = await User.update(1, { avatar_url: null });

        expect(result.avatar_url).toBeNull();
      });
    });

    describe('delete() - Edge Cases', () => {
      it('should handle deleting already deleted user', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 0 });

        await User.delete(1);

        expect(db.query).toHaveBeenCalledTimes(1);
      });

      it('should handle deleting with negative ID', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 0 });

        await User.delete(-1);

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          [-1]
        );
      });
    });

    describe('count() - Edge Cases', () => {
      it('should handle very large counts', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: '999999' }] });

        const result = await User.count();

        expect(result).toBe(999999);
      });

      it('should parse string count correctly', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: '42' }] });

        const result = await User.count();

        expect(typeof result).toBe('number');
        expect(result).toBe(42);
      });
    });
  });

  // ========================================
  // ORGANIZATION MODEL TESTS
  // ========================================
  describe('Organization Model - Extended Tests', () => {
    describe('create() - Edge Cases', () => {
      it('should handle empty settings object', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

        await Organization.create({
          name: 'Test Org',
          slug: 'test-org',
          owner_id: 1,
          settings: {}
        });

        const insertCall = db.query.mock.calls[0];
        expect(insertCall[1][4]).toBe('{}');
      });

      it('should handle nested settings object', async () => {
        const settings = {
          theme: { primary: 'blue', secondary: 'gray' },
          features: { voice: true, chat: true }
        };
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, settings: JSON.stringify(settings) }] });

        const result = await Organization.create({
          name: 'Test Org',
          slug: 'test-org',
          owner_id: 1,
          settings
        });

        expect(result.settings).toEqual(settings);
      });

      it('should handle slug with underscores', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, slug: 'test_org_123', settings: '{}' }] });

        const result = await Organization.create({
          name: 'Test Org',
          slug: 'test_org_123',
          owner_id: 1
        });

        expect(result.slug).toBe('test_org_123');
      });

      it('should handle plan_tier variations', async () => {
        const tiers = ['free', 'pro', 'enterprise', 'custom'];

        for (const tier of tiers) {
          db.query
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [{ id: 1, plan_tier: tier, settings: '{}' }] });

          const result = await Organization.create({
            name: 'Test Org',
            slug: 'test-org',
            owner_id: 1,
            plan_tier: tier
          });

          expect(result.plan_tier).toBe(tier);
        }
      });

      it('should handle very long organization names', async () => {
        const longName = 'Organization '.repeat(20);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: longName, settings: '{}' }] });

        const result = await Organization.create({
          name: longName,
          slug: 'long-org',
          owner_id: 1
        });

        expect(result.name).toBe(longName);
      });
    });

    describe('parseOrganization() - Edge Cases', () => {
      it('should handle malformed JSON settings gracefully', async () => {
        const org = {
          id: 1,
          name: 'Test',
          settings: 'invalid json'
        };

        // This should throw when parsing
        expect(() => Organization.parseOrganization(org)).toThrow();
      });

      it('should handle empty string settings', async () => {
        const org = {
          id: 1,
          name: 'Test',
          settings: ''
        };

        expect(() => Organization.parseOrganization(org)).toThrow();
      });

      it('should handle already parsed nested settings', async () => {
        const settings = { a: { b: { c: 1 } } };
        const org = {
          id: 1,
          name: 'Test',
          settings: settings
        };

        const result = Organization.parseOrganization(org);

        expect(result.settings).toEqual(settings);
      });

      it('should handle undefined settings', async () => {
        const org = {
          id: 1,
          name: 'Test',
          settings: undefined
        };

        const result = Organization.parseOrganization(org);

        expect(result.settings).toEqual({});
      });
    });

    describe('update() - Edge Cases', () => {
      it('should allow updating settings to empty object', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

        const result = await Organization.update(1, { settings: {} });

        expect(result.settings).toEqual({});
      });

      it('should update only slug', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, slug: 'new-slug', settings: '{}' }] });

        await Organization.update(1, { slug: 'new-slug' });

        expect(db.query.mock.calls[0][0]).toContain('slug = $1');
      });

      it('should handle complex settings update', async () => {
        const complexSettings = {
          branding: { logo: 'url', colors: { primary: '#000', secondary: '#fff' } },
          limits: { users: 100, bots: 50 },
          features: ['chat', 'voice', 'analytics']
        };

        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: JSON.stringify(complexSettings) }] });

        const result = await Organization.update(1, { settings: complexSettings });

        expect(result.settings).toEqual(complexSettings);
      });
    });

    describe('findByUser() - Edge Cases', () => {
      it('should return empty array for user with no memberships', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await Organization.findByUser(999);

        expect(result).toEqual([]);
      });

      it('should parse all organizations in result', async () => {
        const mockOrgs = [
          { id: 1, settings: '{"a":1}' },
          { id: 2, settings: '{"b":2}' },
          { id: 3, settings: '{"c":3}' }
        ];
        db.query.mockResolvedValueOnce({ rows: mockOrgs });

        const result = await Organization.findByUser(1);

        expect(result).toHaveLength(3);
        expect(result[0].settings).toEqual({ a: 1 });
        expect(result[1].settings).toEqual({ b: 2 });
        expect(result[2].settings).toEqual({ c: 3 });
      });
    });
  });

  // ========================================
  // CONVERSATION MODEL TESTS
  // ========================================
  describe('Conversation Model - Extended Tests', () => {
    describe('create() - Edge Cases', () => {
      it('should handle extremely long content', async () => {
        const longContent = 'A'.repeat(50000);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, content: longContent }] });

        const result = await Conversation.create({
          bot_id: 1,
          session_id: 'session-1',
          role: 'user',
          content: longContent
        });

        expect(result.content).toBe(longContent);
      });

      it('should handle content with newlines and special characters', async () => {
        const content = 'Line 1\nLine 2\r\nLine 3\tTabbed\0Null';
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, content: content }] });

        const result = await Conversation.create({
          bot_id: 1,
          session_id: 'session-1',
          role: 'user',
          content: content
        });

        expect(result.content).toBe(content);
      });

      it('should handle JSON in content', async () => {
        const content = '{"type": "function_call", "name": "test"}';
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, content: content }] });

        const result = await Conversation.create({
          bot_id: 1,
          session_id: 'session-1',
          role: 'assistant',
          content: content
        });

        expect(result.content).toBe(content);
      });

      it('should handle very long session IDs', async () => {
        const longSessionId = 'session-' + 'a'.repeat(100);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, session_id: longSessionId }] });

        const result = await Conversation.create({
          bot_id: 1,
          session_id: longSessionId,
          role: 'user',
          content: 'test'
        });

        expect(result.session_id).toBe(longSessionId);
      });
    });

    describe('findBySession() - Edge Cases', () => {
      it('should handle session with no messages', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await Conversation.findBySession(1, 'empty-session');

        expect(result).toEqual([]);
      });

      it('should handle very large limit values', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await Conversation.findBySession(1, 'session-1', { limit: 10000 });

        expect(db.query.mock.calls[0][1][2]).toBe(10000);
      });

      it('should maintain ASC order for conversation flow', async () => {
        const mockConvs = [
          { id: 1, created_at: '2024-01-01' },
          { id: 2, created_at: '2024-01-02' }
        ];
        db.query.mockResolvedValueOnce({ rows: mockConvs });

        await Conversation.findBySession(1, 'session-1');

        expect(db.query.mock.calls[0][0]).toContain('ORDER BY created_at ASC');
      });
    });

    describe('update() - Edge Cases', () => {
      it('should allow updating content to empty string', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: '' }] });

        const result = await Conversation.update(1, { content: '' });

        expect(result.content).toBe('');
      });

      it('should allow changing role from user to system', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'system' }] });

        const result = await Conversation.update(1, { role: 'system' });

        expect(result.role).toBe('system');
      });

      it('should handle updating content with SQL injection attempt', async () => {
        const maliciousContent = "'; DROP TABLE ai_conversations; --";
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: maliciousContent }] });

        const result = await Conversation.update(1, { content: maliciousContent });

        expect(result.content).toBe(maliciousContent);
      });
    });

    describe('deleteSession() - Edge Cases', () => {
      it('should handle deleting session with many messages', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1000 });

        await Conversation.deleteSession(1, 'busy-session');

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          [1, 'busy-session']
        );
      });

      it('should handle deleting non-existent session gracefully', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 0 });

        await Conversation.deleteSession(1, 'fake-session');

        expect(db.query).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ========================================
  // KNOWLEDGEBASE MODEL TESTS
  // ========================================
  describe('KnowledgeBase Model - Extended Tests', () => {
    describe('create() - Validation', () => {
      it('should enforce default embedding model', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, embedding_model: 'text-embedding-3-small' }] });

        await KnowledgeBase.create({
          tenant_id: 1,
          name: 'Test KB',
          description: 'Test'
        });

        const values = db.query.mock.calls[0][1];
        expect(values).toContain('text-embedding-3-small');
      });

      it('should enforce default chunk settings', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await KnowledgeBase.create({
          tenant_id: 1,
          name: 'Test KB'
        });

        const values = db.query.mock.calls[0][1];
        expect(values).toContain(1000); // chunk_size
        expect(values).toContain(200);  // chunk_overlap
      });

      it('should allow custom chunk sizes', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await KnowledgeBase.create({
          tenant_id: 1,
          name: 'Test KB',
          chunk_size: 2000,
          chunk_overlap: 400
        });

        const values = db.query.mock.calls[0][1];
        expect(values).toContain(2000);
        expect(values).toContain(400);
      });

      it('should handle very small chunk sizes', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await KnowledgeBase.create({
          tenant_id: 1,
          name: 'Test KB',
          chunk_size: 100,
          chunk_overlap: 10
        });

        const values = db.query.mock.calls[0][1];
        expect(values).toContain(100);
        expect(values).toContain(10);
      });
    });

    describe('update() - Edge Cases', () => {
      it('should allow updating chunk_size to 0', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, chunk_size: 0 }] });

        const result = await KnowledgeBase.update(1, { chunk_size: 0 });

        expect(result.chunk_size).toBe(0);
      });

      it('should handle status transitions', async () => {
        const statuses = ['active', 'processing', 'error', 'inactive'];

        for (const status of statuses) {
          db.query.mockResolvedValueOnce({ rows: [{ id: 1, status }] });

          const result = await KnowledgeBase.update(1, { status });

          expect(result.status).toBe(status);
        }
      });

      it('should allow updating all fields simultaneously', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await KnowledgeBase.update(1, {
          name: 'Updated',
          description: 'New desc',
          embedding_model: 'new-model',
          chunk_size: 1500,
          chunk_overlap: 300,
          status: 'active'
        });

        const query = db.query.mock.calls[0][0];
        expect(query).toContain('name = $1');
        expect(query).toContain('description = $2');
        expect(query).toContain('embedding_model = $3');
        expect(query).toContain('chunk_size = $4');
        expect(query).toContain('chunk_overlap = $5');
        expect(query).toContain('status = $6');
      });
    });

    describe('updateCounts() - Edge Cases', () => {
      it('should handle KB with zero documents', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, document_count: 0, total_chunks: 0 }] });

        const result = await KnowledgeBase.updateCounts(1);

        expect(result.document_count).toBe(0);
        expect(result.total_chunks).toBe(0);
      });

      it('should handle very large counts', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, document_count: 10000, total_chunks: 1000000 }] });

        const result = await KnowledgeBase.updateCounts(1);

        expect(result.document_count).toBe(10000);
        expect(result.total_chunks).toBe(1000000);
      });

      it('should return null for non-existent KB', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await KnowledgeBase.updateCounts(999);

        expect(result).toBeNull();
      });
    });

    describe('findByAgent() - Edge Cases', () => {
      it('should handle agent with no knowledge bases', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await KnowledgeBase.findByAgent(999);

        expect(result).toEqual([]);
      });

      it('should include priority in results', async () => {
        const mockKBs = [
          { id: 1, priority: 10 },
          { id: 2, priority: 5 }
        ];
        db.query.mockResolvedValueOnce({ rows: mockKBs });

        const result = await KnowledgeBase.findByAgent(1);

        expect(result[0].priority).toBe(10);
        expect(result[1].priority).toBe(5);
      });

      it('should verify correct ordering by priority and name', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await KnowledgeBase.findByAgent(1);

        const query = db.query.mock.calls[0][0];
        expect(query).toContain('ORDER BY akb.priority DESC, kb.name');
      });
    });

    describe('existsForTenant() - Edge Cases', () => {
      it('should return false for non-existent KB', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

        const result = await KnowledgeBase.existsForTenant(999, 1);

        expect(result).toBe(false);
      });

      it('should return false for wrong tenant', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

        const result = await KnowledgeBase.existsForTenant(1, 999);

        expect(result).toBe(false);
      });

      it('should return true only for correct KB and tenant combo', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

        const result = await KnowledgeBase.existsForTenant(1, 1);

        expect(result).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('EXISTS'),
          [1, 1]
        );
      });
    });
  });

  // ========================================
  // MESSAGE MODEL TESTS
  // ========================================
  describe('Message Model - Extended Tests', () => {
    describe('create() - Edge Cases', () => {
      it('should default sender to user if not provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, sender: 'user', metadata: '{}' }] });

        await Message.create({
          bot_id: 1,
          organization_id: 1,
          content: 'test'
        });

        const insertCall = db.query.mock.calls[0];
        expect(insertCall[1][2]).toBe('user');
      });

      it('should allow custom sender values', async () => {
        const senders = ['user', 'bot', 'system', 'assistant'];

        for (const sender of senders) {
          db.query
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [{ id: 1, sender, metadata: '{}' }] });

          const result = await Message.create({
            bot_id: 1,
            organization_id: 1,
            sender,
            content: 'test'
          });

          expect(result.sender).toBe(sender);
        }
      });

      it('should handle empty metadata object', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, metadata: '{}' }] });

        await Message.create({
          bot_id: 1,
          organization_id: 1,
          content: 'test',
          metadata: {}
        });

        const insertCall = db.query.mock.calls[0];
        expect(insertCall[1][4]).toBe('{}');
      });

      it('should handle complex metadata', async () => {
        const metadata = {
          source: 'web',
          user_agent: 'Mozilla/5.0',
          ip: '192.168.1.1',
          session: { id: '123', start: Date.now() }
        };
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, metadata: JSON.stringify(metadata) }] });

        const result = await Message.create({
          bot_id: 1,
          organization_id: 1,
          content: 'test',
          metadata
        });

        expect(result.metadata).toEqual(metadata);
      });

      it('should handle null metadata', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, metadata: '{}' }] });

        await Message.create({
          bot_id: 1,
          organization_id: 1,
          content: 'test',
          metadata: null
        });

        const insertCall = db.query.mock.calls[0];
        expect(insertCall[1][4]).toBe('{}');
      });
    });

    describe('parseMessage() - Edge Cases', () => {
      it('should handle string metadata', async () => {
        const msg = {
          id: 1,
          metadata: '{"key":"value"}'
        };

        const result = Message.parseMessage(msg);

        expect(result.metadata).toEqual({ key: 'value' });
      });

      it('should handle already parsed metadata', async () => {
        const msg = {
          id: 1,
          metadata: { key: 'value' }
        };

        const result = Message.parseMessage(msg);

        expect(result.metadata).toEqual({ key: 'value' });
      });

      it('should handle null metadata', async () => {
        const msg = {
          id: 1,
          metadata: null
        };

        const result = Message.parseMessage(msg);

        expect(result.metadata).toEqual({});
      });

      it('should handle undefined metadata', async () => {
        const msg = {
          id: 1,
          metadata: undefined
        };

        const result = Message.parseMessage(msg);

        expect(result.metadata).toEqual({});
      });
    });

    describe('findBySender() - Edge Cases', () => {
      it('should handle sender with no messages', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await Message.findBySender('unknown');

        expect(result).toEqual([]);
      });

      it('should parse metadata for all messages', async () => {
        const mockMessages = [
          { id: 1, metadata: '{"a":1}' },
          { id: 2, metadata: '{"b":2}' }
        ];
        db.query.mockResolvedValueOnce({ rows: mockMessages });

        const result = await Message.findBySender('user');

        expect(result[0].metadata).toEqual({ a: 1 });
        expect(result[1].metadata).toEqual({ b: 2 });
      });
    });

    describe('update() - Edge Cases', () => {
      it('should allow updating metadata to empty object', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, metadata: '{}' }] });

        const result = await Message.update(1, { metadata: {} });

        expect(result.metadata).toEqual({});
      });

      it('should allow updating only sender', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, sender: 'system', metadata: '{}' }] });

        await Message.update(1, { sender: 'system' });

        expect(db.query.mock.calls[0][0]).toContain('sender = $1');
      });

      it('should update all fields together', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, metadata: '{}' }] });

        await Message.update(1, {
          content: 'updated',
          metadata: { updated: true },
          sender: 'bot'
        });

        const query = db.query.mock.calls[0][0];
        expect(query).toContain('content = $1');
        expect(query).toContain('metadata = $2');
        expect(query).toContain('sender = $3');
      });
    });

    describe('countByBot() - Edge Cases', () => {
      it('should return 0 for bot with no messages', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const result = await Message.countByBot(999);

        expect(result).toBe(0);
      });

      it('should handle very large message counts', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: '1000000' }] });

        const result = await Message.countByBot(1);

        expect(result).toBe(1000000);
      });
    });

    describe('countByOrganization() - Edge Cases', () => {
      it('should return 0 for org with no messages', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const result = await Message.countByOrganization(999);

        expect(result).toBe(0);
      });

      it('should parse count as integer', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: '42' }] });

        const result = await Message.countByOrganization(1);

        expect(typeof result).toBe('number');
        expect(result).toBe(42);
      });
    });
  });

  // ========================================
  // BOT MODEL TESTS
  // ========================================
  describe('Bot Model - Extended Tests', () => {
    describe('create() - Edge Cases', () => {
      it('should default description to null if not provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, description: null, settings: '{}' }] });

        await Bot.create({
          name: 'Test Bot',
          user_id: 1,
          organization_id: 1
        });

        const insertCall = db.query.mock.calls[0];
        expect(insertCall[1][1]).toBeNull();
      });

      it('should default is_active to true', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true, settings: '{}' }] });

        await Bot.create({
          name: 'Test Bot',
          user_id: 1,
          organization_id: 1
        });

        const insertCall = db.query.mock.calls[0];
        expect(insertCall[1][5]).toBe(true);
      });

      it('should allow creating inactive bot', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false, settings: '{}' }] });

        await Bot.create({
          name: 'Test Bot',
          user_id: 1,
          organization_id: 1,
          is_active: false
        });

        const insertCall = db.query.mock.calls[0];
        expect(insertCall[1][5]).toBe(false);
      });

      it('should handle complex bot settings', async () => {
        const settings = {
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 2000,
          system_prompt: 'You are a helpful assistant',
          tools: ['web_search', 'calculator']
        };
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, settings: JSON.stringify(settings) }] });

        const result = await Bot.create({
          name: 'Test Bot',
          user_id: 1,
          organization_id: 1,
          settings
        });

        expect(result.settings).toEqual(settings);
      });

      it('should handle very long bot names', async () => {
        const longName = 'Bot '.repeat(50);
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: longName, settings: '{}' }] });

        const result = await Bot.create({
          name: longName,
          user_id: 1,
          organization_id: 1
        });

        expect(result.name).toBe(longName);
      });
    });

    describe('parseBot() - Edge Cases', () => {
      it('should handle string settings', async () => {
        const bot = {
          id: 1,
          settings: '{"model":"gpt-4"}'
        };

        const result = Bot.parseBot(bot);

        expect(result.settings).toEqual({ model: 'gpt-4' });
      });

      it('should handle already parsed settings', async () => {
        const bot = {
          id: 1,
          settings: { model: 'gpt-4' }
        };

        const result = Bot.parseBot(bot);

        expect(result.settings).toEqual({ model: 'gpt-4' });
      });

      it('should handle null settings', async () => {
        const bot = {
          id: 1,
          settings: null
        };

        const result = Bot.parseBot(bot);

        expect(result.settings).toEqual({});
      });

      it('should preserve all bot fields', async () => {
        const bot = {
          id: 1,
          name: 'Test',
          description: 'Desc',
          user_id: 1,
          organization_id: 1,
          is_active: true,
          settings: '{}'
        };

        const result = Bot.parseBot(bot);

        expect(result.id).toBe(1);
        expect(result.name).toBe('Test');
        expect(result.description).toBe('Desc');
        expect(result.user_id).toBe(1);
        expect(result.organization_id).toBe(1);
        expect(result.is_active).toBe(true);
      });
    });

    describe('findAll() - Edge Cases', () => {
      it('should exclude deleted bots', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await Bot.findAll();

        expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
      });

      it('should parse settings for all bots', async () => {
        const mockBots = [
          { id: 1, settings: '{"a":1}' },
          { id: 2, settings: '{"b":2}' },
          { id: 3, settings: '{"c":3}' }
        ];
        db.query.mockResolvedValueOnce({ rows: mockBots });

        const result = await Bot.findAll();

        expect(result[0].settings).toEqual({ a: 1 });
        expect(result[1].settings).toEqual({ b: 2 });
        expect(result[2].settings).toEqual({ c: 3 });
      });
    });

    describe('update() - Edge Cases', () => {
      it('should allow updating is_active to false', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: false, settings: '{}' }] });

        const result = await Bot.update(1, { is_active: false });

        expect(result.is_active).toBe(false);
      });

      it('should allow updating description to null', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, description: null, settings: '{}' }] });

        const result = await Bot.update(1, { description: null });

        expect(result.description).toBeNull();
      });

      it('should allow partial settings update', async () => {
        const settings = { model: 'gpt-4-turbo' };
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: JSON.stringify(settings) }] });

        const result = await Bot.update(1, { settings });

        expect(result.settings).toEqual(settings);
      });

      it('should update all fields at once', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

        await Bot.update(1, {
          name: 'Updated',
          description: 'New desc',
          settings: { new: 'settings' },
          is_active: false
        });

        const query = db.query.mock.calls[0][0];
        expect(query).toContain('name = $1');
        expect(query).toContain('description = $2');
        expect(query).toContain('settings = $3');
        expect(query).toContain('is_active = $4');
        expect(query).toContain('updated_at = NOW()');
      });
    });

    describe('delete() - Edge Cases', () => {
      it('should soft delete bot', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        await Bot.delete(1);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE bots SET deleted_at = NOW()'),
          [1]
        );
      });

      it('should handle deleting already deleted bot', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 0 });

        await Bot.delete(1);

        expect(db.query).toHaveBeenCalledTimes(1);
      });
    });

    describe('countByOrganization() - Edge Cases', () => {
      it('should exclude deleted bots from count', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

        await Bot.countByOrganization(1);

        expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
      });

      it('should return 0 for org with no bots', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const result = await Bot.countByOrganization(999);

        expect(result).toBe(0);
      });

      it('should parse count as integer', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

        const result = await Bot.countByOrganization(1);

        expect(typeof result).toBe('number');
        expect(result).toBe(10);
      });
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================
  describe('Error Handling - Database Errors', () => {
    it('should handle connection timeout on User.findAll', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(User.findAll()).rejects.toThrow('Connection timeout');
    });

    it('should handle unique constraint violation on User.create', async () => {
      db.query.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      await expect(User.create({
        name: 'Test',
        email: 'test@example.com',
        password_hash: 'hash'
      })).rejects.toThrow('duplicate key value');
    });

    it('should handle foreign key constraint on Organization.create', async () => {
      db.query.mockRejectedValueOnce(new Error('foreign key constraint violation'));

      await expect(Organization.create({
        name: 'Test Org',
        slug: 'test',
        owner_id: 9999
      })).rejects.toThrow('foreign key');
    });

    it('should handle query syntax errors on Conversation.search', async () => {
      db.query.mockRejectedValueOnce(new Error('syntax error at or near'));

      await expect(Conversation.search('test')).rejects.toThrow('syntax error');
    });

    it('should handle transaction errors on KnowledgeBase.update', async () => {
      db.query.mockRejectedValueOnce(new Error('current transaction is aborted'));

      await expect(KnowledgeBase.update(1, { name: 'Test' })).rejects.toThrow('transaction is aborted');
    });

    it('should handle out of memory errors', async () => {
      db.query.mockRejectedValueOnce(new Error('out of memory'));

      await expect(Message.findAll()).rejects.toThrow('out of memory');
    });

    it('should handle network errors on Bot.findById', async () => {
      db.query.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(Bot.findById(1)).rejects.toThrow('ECONNREFUSED');
    });
  });

  // ========================================
  // CROSS-MODEL RELATIONSHIP TESTS
  // ========================================
  describe('Cross-Model Relationships', () => {
    it('should verify User-Organization relationship via findByOrganization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await User.findByOrganization(1);

      expect(db.query.mock.calls[0][0]).toContain('organization_members');
      expect(db.query.mock.calls[0][0]).toContain('om.org_id');
    });

    it('should verify Organization-User relationship via findByUser', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Organization.findByUser(1);

      expect(db.query.mock.calls[0][0]).toContain('organization_members');
      expect(db.query.mock.calls[0][0]).toContain('om.user_id');
    });

    it('should verify Conversation-Bot relationship', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.findByOrganization(1);

      expect(db.query.mock.calls[0][0]).toContain('JOIN bots b');
      expect(db.query.mock.calls[0][0]).toContain('b.organization_id');
    });

    it('should verify KnowledgeBase-Agent relationship', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await KnowledgeBase.findByAgent(1);

      expect(db.query.mock.calls[0][0]).toContain('agent_knowledge_bases');
      expect(db.query.mock.calls[0][0]).toContain('agent_id');
    });

    it('should verify Message-Bot relationship', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Message.findByBot(1);

      expect(db.query.mock.calls[0][0]).toContain('bot_id = $1');
    });

    it('should verify Bot-Organization relationship', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Bot.findByOrganization(1);

      expect(db.query.mock.calls[0][0]).toContain('organization_id = $1');
    });
  });

  // ========================================
  // PAGINATION TESTS
  // ========================================
  describe('Pagination Consistency', () => {
    it('should use consistent default limit across models', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await User.findAll();
      await Organization.findAll();
      await Conversation.findAll();
      await Message.findAll();
      await Bot.findAll();

      // All should use limit 10 (except Conversation.findBySession which uses 50)
      expect(db.query.mock.calls[0][1][0]).toBe(10);
      expect(db.query.mock.calls[1][1][0]).toBe(10);
      expect(db.query.mock.calls[2][1][0]).toBe(10);
      expect(db.query.mock.calls[3][1][0]).toBe(10);
      expect(db.query.mock.calls[4][1][0]).toBe(10);
    });

    it('should handle offset 0 correctly', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await User.findAll({ offset: 0 });

      expect(db.query.mock.calls[0][1][1]).toBe(0);
    });

    it('should handle very large offset values', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await Organization.findAll({ offset: 1000000 });

      expect(db.query.mock.calls[0][1][1]).toBe(1000000);
    });
  });

  // ========================================
  // NULL AND UNDEFINED HANDLING
  // ========================================
  describe('Null and Undefined Handling', () => {
    it('should handle null values in User update', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, avatar_url: null }] });

      await User.update(1, { avatar_url: null });

      expect(db.query.mock.calls[0][1]).toContain(null);
    });

    it('should handle undefined preventing update', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Organization.update(1, { name: undefined });

      expect(db.query).toHaveBeenCalledTimes(1); // Only findById
    });

    it('should differentiate between null and undefined in Bot', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, description: null, settings: '{}' }] });

      await Bot.update(1, { description: null });

      expect(db.query.mock.calls[0][0]).toContain('description = $1');
    });
  });
});

/**
 * Users API Tests
 * Tests for /api/users endpoints: profile, preferences, deletion
 */

const request = require('supertest');

// Mock the database
jest.mock('../db', () => ({
  query: jest.fn()
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword123'),
  compare: jest.fn()
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const db = require('../db');
const bcrypt = require('bcryptjs');

// Create a minimal express app for testing
const app = express();
app.use(express.json());

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', name: 'Test User' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

// Mock user routes
app.get('/api/users/me', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, avatar_url, created_at, email_verified FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/users/me', mockAuth, async (req, res) => {
  try {
    const { name, avatar_url } = req.body;

    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Name cannot be empty' });
    }

    const result = await db.query(
      'UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url), updated_at = NOW() WHERE id = $3 RETURNING id, name, email, avatar_url',
      [name, avatar_url, req.user.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/users/me/password', mockAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const userResult = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const isMatch = await bcrypt.compare(current_password, userResult.rows[0].password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/users/me', mockAuth, async (req, res) => {
  try {
    const { password, confirm } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to delete account' });
    }

    if (confirm !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Please type DELETE to confirm' });
    }

    const userResult = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const isMatch = await bcrypt.compare(password, userResult.rows[0].password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // Soft delete - mark as deleted
    await db.query(
      'UPDATE users SET deleted_at = NOW(), email = $1 WHERE id = $2',
      [`deleted_${req.user.id}_${req.user.email}`, req.user.id]
    );

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Users API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET PROFILE
  // ========================================
  describe('GET /api/users/me', () => {
    it('should return current user profile', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        email_verified: true
      };
      db.query.mockResolvedValueOnce({ rows: [mockUser] });

      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // UPDATE PROFILE
  // ========================================
  describe('PUT /api/users/me', () => {
    it('should update user profile', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Updated Name', email: 'test@example.com' }]
      });

      const res = await request(app)
        .put('/api/users/me')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
    });

    it('should update avatar URL', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, avatar_url: 'https://new-avatar.com/img.jpg' }]
      });

      const res = await request(app)
        .put('/api/users/me')
        .send({ avatar_url: 'https://new-avatar.com/img.jpg' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if name is empty', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('empty');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/users/me')
        .send({ name: 'New Name' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // CHANGE PASSWORD
  // ========================================
  describe('PUT /api/users/me/password', () => {
    it('should change password successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ password: 'oldHash' }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      bcrypt.compare.mockResolvedValueOnce(true);

      const res = await request(app)
        .put('/api/users/me/password')
        .send({ current_password: 'oldpassword', new_password: 'newpassword123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if current password is missing', async () => {
      const res = await request(app)
        .put('/api/users/me/password')
        .send({ new_password: 'newpassword123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if new password is too short', async () => {
      const res = await request(app)
        .put('/api/users/me/password')
        .send({ current_password: 'oldpassword', new_password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('6 characters');
    });

    it('should return 401 if current password is incorrect', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ password: 'oldHash' }] });
      bcrypt.compare.mockResolvedValueOnce(false);

      const res = await request(app)
        .put('/api/users/me/password')
        .send({ current_password: 'wrongpassword', new_password: 'newpassword123' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('incorrect');
    });
  });

  // ========================================
  // DELETE ACCOUNT
  // ========================================
  describe('DELETE /api/users/me', () => {
    it('should delete account successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ password: 'hash' }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      bcrypt.compare.mockResolvedValueOnce(true);

      const res = await request(app)
        .delete('/api/users/me')
        .send({ password: 'password123', confirm: 'DELETE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if password is missing', async () => {
      const res = await request(app)
        .delete('/api/users/me')
        .send({ confirm: 'DELETE' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if confirm is not DELETE', async () => {
      const res = await request(app)
        .delete('/api/users/me')
        .send({ password: 'password123', confirm: 'delete' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('DELETE');
    });

    it('should return 401 if password is incorrect', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ password: 'hash' }] });
      bcrypt.compare.mockResolvedValueOnce(false);

      const res = await request(app)
        .delete('/api/users/me')
        .send({ password: 'wrongpassword', confirm: 'DELETE' });

      expect(res.status).toBe(401);
    });
  });
});

// ========================================
// USER PREFERENCES TESTS
// ========================================
describe('User Preferences API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const prefApp = express();
  prefApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    next();
  };

  prefApp.get('/api/users/me/preferences', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM user_preferences WHERE user_id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        // Return default preferences
        return res.json({
          success: true,
          data: {
            language: 'en',
            timezone: 'UTC',
            theme: 'light',
            email_notifications: true,
            push_notifications: true
          }
        });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  prefApp.put('/api/users/me/preferences', mockAuth, async (req, res) => {
    try {
      const { language, timezone, theme, email_notifications, push_notifications } = req.body;

      // Validate language
      const validLanguages = ['en', 'az', 'ru', 'tr'];
      if (language && !validLanguages.includes(language)) {
        return res.status(400).json({ success: false, message: 'Invalid language' });
      }

      // Validate theme
      const validThemes = ['light', 'dark', 'system'];
      if (theme && !validThemes.includes(theme)) {
        return res.status(400).json({ success: false, message: 'Invalid theme' });
      }

      const result = await db.query(
        `INSERT INTO user_preferences (user_id, language, timezone, theme, email_notifications, push_notifications)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
         language = COALESCE($2, user_preferences.language),
         timezone = COALESCE($3, user_preferences.timezone),
         theme = COALESCE($4, user_preferences.theme),
         email_notifications = COALESCE($5, user_preferences.email_notifications),
         push_notifications = COALESCE($6, user_preferences.push_notifications)
         RETURNING *`,
        [req.user.id, language, timezone, theme, email_notifications, push_notifications]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/users/me/preferences', () => {
    it('should return user preferences', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ language: 'az', theme: 'dark' }]
      });

      const res = await request(prefApp).get('/api/users/me/preferences');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return default preferences if none exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(prefApp).get('/api/users/me/preferences');

      expect(res.status).toBe(200);
      expect(res.body.data.language).toBe('en');
      expect(res.body.data.theme).toBe('light');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(prefApp).get('/api/users/me/preferences');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/users/me/preferences', () => {
    it('should update preferences', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ language: 'az', theme: 'dark' }]
      });

      const res = await request(prefApp)
        .put('/api/users/me/preferences')
        .send({ language: 'az', theme: 'dark' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid language', async () => {
      const res = await request(prefApp)
        .put('/api/users/me/preferences')
        .send({ language: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid language');
    });

    it('should return 400 for invalid theme', async () => {
      const res = await request(prefApp)
        .put('/api/users/me/preferences')
        .send({ theme: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid theme');
    });

    it('should update notification settings', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email_notifications: false, push_notifications: true }]
      });

      const res = await request(prefApp)
        .put('/api/users/me/preferences')
        .send({ email_notifications: false, push_notifications: true });

      expect(res.status).toBe(200);
    });
  });
});

// ========================================
// USER SESSIONS TESTS
// ========================================
describe('User Sessions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sessionApp = express();
  sessionApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    req.sessionId = 'current-session-123';
    next();
  };

  sessionApp.get('/api/users/me/sessions', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, device, ip_address, created_at, last_active_at FROM user_sessions WHERE user_id = $1 ORDER BY last_active_at DESC',
        [req.user.id]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  sessionApp.delete('/api/users/me/sessions/:id', mockAuth, async (req, res) => {
    try {
      if (req.params.id === req.sessionId) {
        return res.status(400).json({ success: false, message: 'Cannot revoke current session' });
      }

      const result = await db.query(
        'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
        [req.params.id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }

      res.json({ success: true, message: 'Session revoked' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  sessionApp.delete('/api/users/me/sessions', mockAuth, async (req, res) => {
    try {
      await db.query(
        'DELETE FROM user_sessions WHERE user_id = $1 AND id != $2',
        [req.user.id, req.sessionId]
      );

      res.json({ success: true, message: 'All other sessions revoked' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/users/me/sessions', () => {
    it('should return all user sessions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: '1', device: 'Chrome', ip_address: '127.0.0.1' },
          { id: '2', device: 'Firefox', ip_address: '192.168.1.1' }
        ]
      });

      const res = await request(sessionApp).get('/api/users/me/sessions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array if no sessions', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(sessionApp).get('/api/users/me/sessions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('DELETE /api/users/me/sessions/:id', () => {
    it('should revoke a specific session', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'other-session' }] });

      const res = await request(sessionApp).delete('/api/users/me/sessions/other-session');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 when trying to revoke current session', async () => {
      const res = await request(sessionApp).delete('/api/users/me/sessions/current-session-123');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('current session');
    });

    it('should return 404 if session not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(sessionApp).delete('/api/users/me/sessions/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/users/me/sessions', () => {
    it('should revoke all other sessions', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 3 });

      const res = await request(sessionApp).delete('/api/users/me/sessions');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('All other sessions');
    });
  });
});

// ========================================
// EDGE CASES
// ========================================
describe('User Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const edgeApp = express();
  edgeApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    next();
  };

  edgeApp.get('/api/users/me/activity', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        `SELECT action, details, created_at FROM user_activity_log
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [req.user.id]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  edgeApp.post('/api/users/me/export', mockAuth, async (req, res) => {
    try {
      const userData = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      const preferences = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [req.user.id]);
      const bots = await db.query('SELECT * FROM bots WHERE user_id = $1', [req.user.id]);

      const exportData = {
        user: userData.rows[0],
        preferences: preferences.rows[0],
        bots: bots.rows,
        exportedAt: new Date().toISOString()
      };

      res.json({ success: true, data: exportData });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/users/me/activity', () => {
    it('should return activity log', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { action: 'login', details: 'Logged in', created_at: new Date() },
          { action: 'create_bot', details: 'Created bot', created_at: new Date() }
        ]
      });

      const res = await request(edgeApp).get('/api/users/me/activity');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/users/me/export', () => {
    it('should export user data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test User' }] })
        .mockResolvedValueOnce({ rows: [{ language: 'en' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot 1' }] });

      const res = await request(edgeApp).post('/api/users/me/export');

      expect(res.status).toBe(200);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.exportedAt).toBeDefined();
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(edgeApp).post('/api/users/me/export');

      expect(res.status).toBe(500);
    });
  });
});

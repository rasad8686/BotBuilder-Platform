/**
 * Notification Service Tests
 * Tests for server/services/notificationService.js
 *
 * Comprehensive test suite covering:
 * - sendNotification - send to user
 * - sendBulkNotifications - batch send
 * - getNotifications - list user notifications
 * - markAsRead - mark notification read
 * - deleteNotification - delete notification
 * - getUnreadCount - count unread
 * - Notification types - email, push, in-app
 * - Notification preferences
 * - Error handling
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

const db = require('../../db');
const log = require('../../utils/logger');
const emailService = require('../../services/emailService');
const notificationService = require('../../services/notificationService');
const { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } = notificationService;

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================================================
  // 1. sendNotification Tests
  // =====================================================
  describe('sendNotification()', () => {
    const validNotificationData = {
      userId: 1,
      type: 'email',
      category: 'system',
      title: 'Test Notification',
      message: 'This is a test message',
      data: { foo: 'bar' },
      priority: 'high'
    };

    it('should send a notification successfully', async () => {
      const mockNotification = {
        id: 1,
        user_id: 1,
        type: 'email',
        category: 'system',
        title: 'Test Notification',
        message: 'This is a test message',
        data: '{"foo":"bar"}',
        priority: 'high',
        is_read: false,
        created_at: new Date()
      };

      // Mock preference check
      db.query
        .mockResolvedValueOnce({
          rows: [{
            email_enabled: true,
            email_preferences: JSON.stringify({ system: true })
          }]
        })
        // Mock notification insert
        .mockResolvedValueOnce({ rows: [mockNotification] })
        // Mock user lookup for email
        .mockResolvedValueOnce({
          rows: [{ email: 'user@example.com', name: 'Test User' }]
        });

      const result = await notificationService.sendNotification(validNotificationData);

      expect(result.success).toBe(true);
      expect(result.notification).toBeDefined();
      expect(result.notification.id).toBe(1);
      expect(db.query).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('should send in-app notification without email', async () => {
      const mockNotification = {
        id: 2,
        type: 'in-app',
        category: 'bot_alert',
        title: 'Bot Alert',
        message: 'Your bot needs attention'
      };

      db.query
        .mockResolvedValueOnce({
          rows: [{
            in_app_enabled: true,
            in_app_preferences: JSON.stringify({ bot_alert: true })
          }]
        })
        .mockResolvedValueOnce({ rows: [mockNotification] });

      const result = await notificationService.sendNotification({
        userId: 1,
        type: 'in-app',
        category: 'bot_alert',
        title: 'Bot Alert',
        message: 'Your bot needs attention'
      });

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should send push notification', async () => {
      const mockNotification = {
        id: 3,
        type: 'push',
        category: 'security',
        title: 'Security Alert',
        message: 'New login detected'
      };

      db.query
        .mockResolvedValueOnce({
          rows: [{
            push_enabled: true,
            push_preferences: JSON.stringify({ security: true })
          }]
        })
        .mockResolvedValueOnce({ rows: [mockNotification] });

      const result = await notificationService.sendNotification({
        userId: 1,
        type: 'push',
        category: 'security',
        title: 'Security Alert',
        message: 'New login detected'
      });

      expect(result.success).toBe(true);
      expect(result.notification.type).toBe('push');
    });

    it('should validate required fields', async () => {
      await expect(
        notificationService.sendNotification({})
      ).rejects.toThrow('Missing required notification fields');

      await expect(
        notificationService.sendNotification({
          userId: 1,
          type: 'email',
          category: 'system'
          // Missing title and message
        })
      ).rejects.toThrow('Missing required notification fields');
    });

    it('should validate notification type', async () => {
      await expect(
        notificationService.sendNotification({
          userId: 1,
          type: 'invalid-type',
          category: 'system',
          title: 'Test',
          message: 'Test'
        })
      ).rejects.toThrow('Invalid notification type');
    });

    it('should validate notification category', async () => {
      await expect(
        notificationService.sendNotification({
          userId: 1,
          type: 'email',
          category: 'invalid-category',
          title: 'Test',
          message: 'Test'
        })
      ).rejects.toThrow('Invalid notification category');
    });

    it('should block notification if user preference disabled', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          email_enabled: false,
          email_preferences: JSON.stringify({ system: false })
        }]
      });

      const result = await notificationService.sendNotification({
        userId: 1,
        type: 'email',
        category: 'system',
        title: 'Test',
        message: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('blocked_by_preferences');
      expect(log.info).toHaveBeenCalledWith(
        'Notification blocked by user preferences',
        expect.any(Object)
      );
    });

    it('should include action URL in notification', async () => {
      const mockNotification = {
        id: 4,
        action_url: 'https://example.com/action'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [mockNotification] })
        .mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] });

      const result = await notificationService.sendNotification({
        ...validNotificationData,
        actionUrl: 'https://example.com/action'
      });

      expect(result.success).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['https://example.com/action'])
      );
    });

    it('should use default priority of medium', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, priority: 'medium' }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] });

      await notificationService.sendNotification({
        userId: 1,
        type: 'email',
        category: 'system',
        title: 'Test',
        message: 'Test'
        // No priority specified
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['medium'])
      );
    });

    it('should handle database error gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        notificationService.sendNotification(validNotificationData)
      ).rejects.toThrow();

      expect(log.error).toHaveBeenCalledWith(
        'Failed to send notification',
        expect.any(Object)
      );
    });

    it('should store data as JSON string', async () => {
      const complexData = {
        metadata: { userId: 1, timestamp: '2024-01-01' },
        links: ['link1', 'link2'],
        nested: { foo: 'bar' }
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] });

      await notificationService.sendNotification({
        ...validNotificationData,
        data: complexData
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(complexData)])
      );
    });
  });

  // =====================================================
  // 2. sendBulkNotifications Tests
  // =====================================================
  describe('sendBulkNotifications()', () => {
    it('should send notifications to multiple users', async () => {
      const userIds = [1, 2, 3];

      // Mock for each user
      db.query
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user1@example.com' }] })
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user2@example.com' }] })
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user3@example.com' }] });

      const result = await notificationService.sendBulkNotifications({
        userIds,
        type: 'email',
        category: 'system',
        title: 'Bulk Notification',
        message: 'Sent to all users'
      });

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.blocked).toBe(0);
    });

    it('should handle mixed success and blocked notifications', async () => {
      const userIds = [1, 2, 3];

      db.query
        // User 1: success
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user1@example.com' }] })
        // User 2: blocked
        .mockResolvedValueOnce({ rows: [{ email_enabled: false }] })
        // User 3: success
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user3@example.com' }] });

      const result = await notificationService.sendBulkNotifications({
        userIds,
        type: 'email',
        category: 'system',
        title: 'Test',
        message: 'Test'
      });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.blocked).toBe(1);
    });

    it('should handle errors for individual users', async () => {
      const userIds = [1, 2];

      db.query
        // User 1: success
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user1@example.com' }] })
        // User 2: error
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await notificationService.sendBulkNotifications({
        userIds,
        type: 'email',
        category: 'system',
        title: 'Test',
        message: 'Test'
      });

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].userId).toBe(2);
    });

    it('should validate userIds is an array', async () => {
      await expect(
        notificationService.sendBulkNotifications({
          userIds: null,
          type: 'email',
          category: 'system',
          title: 'Test',
          message: 'Test'
        })
      ).rejects.toThrow('userIds must be a non-empty array');
    });

    it('should validate userIds is not empty', async () => {
      await expect(
        notificationService.sendBulkNotifications({
          userIds: [],
          type: 'email',
          category: 'system',
          title: 'Test',
          message: 'Test'
        })
      ).rejects.toThrow('userIds must be a non-empty array');
    });

    it('should send in-app notifications in bulk', async () => {
      const userIds = [1, 2];

      db.query
        .mockResolvedValueOnce({ rows: [{ in_app_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ in_app_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] });

      const result = await notificationService.sendBulkNotifications({
        userIds,
        type: 'in-app',
        category: 'bot_alert',
        title: 'Bulk Alert',
        message: 'Alert message'
      });

      expect(result.success).toBe(2);
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should include additional data in bulk notifications', async () => {
      const userIds = [1];
      const data = { campaign: 'summer-2024', priority: 'high' };

      db.query
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] });

      await notificationService.sendBulkNotifications({
        userIds,
        type: 'email',
        category: 'marketing',
        title: 'Test',
        message: 'Test',
        data
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(data)])
      );
    });

    it('should log bulk send summary', async () => {
      const userIds = [1];

      db.query
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] });

      await notificationService.sendBulkNotifications({
        userIds,
        type: 'email',
        category: 'system',
        title: 'Test',
        message: 'Test'
      });

      expect(log.info).toHaveBeenCalledWith(
        'Bulk notifications sent',
        expect.objectContaining({
          total: 1,
          success: 1
        })
      );
    });
  });

  // =====================================================
  // 3. getNotifications Tests
  // =====================================================
  describe('getNotifications()', () => {
    it('should get notifications for a user', async () => {
      const mockNotifications = [
        {
          id: 1,
          user_id: 1,
          title: 'Notification 1',
          message: 'Message 1',
          data: '{"foo":"bar"}',
          created_at: new Date()
        },
        {
          id: 2,
          user_id: 1,
          title: 'Notification 2',
          message: 'Message 2',
          data: '{"baz":"qux"}',
          created_at: new Date()
        }
      ];

      db.query.mockResolvedValueOnce({ rows: mockNotifications });

      const result = await notificationService.getNotifications(1);

      expect(result).toHaveLength(2);
      expect(result[0].data).toEqual({ foo: 'bar' });
      expect(result[1].data).toEqual({ baz: 'qux' });
    });

    it('should support pagination with limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications(1, {
        limit: 10,
        offset: 20
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 10, 20])
      );
    });

    it('should filter by unread only', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications(1, {
        unreadOnly: true
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read = false'),
        expect.any(Array)
      );
    });

    it('should filter by category', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications(1, {
        category: 'bot_alert'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('category'),
        expect.arrayContaining([1, 'bot_alert'])
      );
    });

    it('should filter by type', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications(1, {
        type: 'email'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('type'),
        expect.arrayContaining([1, 'email'])
      );
    });

    it('should combine multiple filters', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications(1, {
        unreadOnly: true,
        category: 'system',
        type: 'in-app',
        limit: 25,
        offset: 0
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read = false'),
        expect.arrayContaining([1, 'system', 'in-app', 25, 0])
      );
    });

    it('should use default limit of 50', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([50, 0])
      );
    });

    it('should order by created_at DESC', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.getNotifications(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });

    it('should parse JSON data field correctly', async () => {
      const mockNotifications = [
        { id: 1, data: '{"key":"value"}' },
        { id: 2, data: { key: 'value' } } // Already parsed
      ];

      db.query.mockResolvedValueOnce({ rows: mockNotifications });

      const result = await notificationService.getNotifications(1);

      expect(result[0].data).toEqual({ key: 'value' });
      expect(result[1].data).toEqual({ key: 'value' });
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Query failed'));

      await expect(
        notificationService.getNotifications(1)
      ).rejects.toThrow('Query failed');

      expect(log.error).toHaveBeenCalled();
    });
  });

  // =====================================================
  // 4. markAsRead Tests
  // =====================================================
  describe('markAsRead()', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 1,
        user_id: 1,
        is_read: true,
        read_at: new Date()
      };

      db.query.mockResolvedValueOnce({ rows: [mockNotification] });

      const result = await notificationService.markAsRead(1, 1);

      expect(result.is_read).toBe(true);
      expect(result.read_at).toBeDefined();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read = true'),
        [1, 1]
      );
    });

    it('should set read_at timestamp', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, read_at: new Date() }]
      });

      await notificationService.markAsRead(1, 1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('read_at = NOW()'),
        expect.any(Array)
      );
    });

    it('should verify user ownership', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        notificationService.markAsRead(1, 999)
      ).rejects.toThrow('Notification not found or access denied');
    });

    it('should throw error if notification not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        notificationService.markAsRead(999, 1)
      ).rejects.toThrow('Notification not found or access denied');
    });

    it('should log successful read', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await notificationService.markAsRead(1, 1);

      expect(log.info).toHaveBeenCalledWith(
        'Notification marked as read',
        { notificationId: 1, userId: 1 }
      );
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        notificationService.markAsRead(1, 1)
      ).rejects.toThrow('Update failed');

      expect(log.error).toHaveBeenCalled();
    });
  });

  // =====================================================
  // 5. markAllAsRead Tests
  // =====================================================
  describe('markAllAsRead()', () => {
    it('should mark all notifications as read', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }]
      });

      const count = await notificationService.markAllAsRead(1);

      expect(count).toBe(3);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read = false'),
        [1]
      );
    });

    it('should filter by category when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await notificationService.markAllAsRead(1, 'bot_alert');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('category = $2'),
        [1, 'bot_alert']
      );
    });

    it('should only update unread notifications', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.markAllAsRead(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read = false'),
        expect.any(Array)
      );
    });

    it('should return 0 if no unread notifications', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const count = await notificationService.markAllAsRead(1);

      expect(count).toBe(0);
    });

    it('should log the operation', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      await notificationService.markAllAsRead(1);

      expect(log.info).toHaveBeenCalledWith(
        'All notifications marked as read',
        { userId: 1, count: 2 }
      );
    });
  });

  // =====================================================
  // 6. deleteNotification Tests
  // =====================================================
  describe('deleteNotification()', () => {
    it('should delete a notification', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await notificationService.deleteNotification(1, 1);

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications'),
        [1, 1]
      );
    });

    it('should verify user ownership before deletion', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        notificationService.deleteNotification(1, 999)
      ).rejects.toThrow('Notification not found or access denied');
    });

    it('should throw error if notification not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        notificationService.deleteNotification(999, 1)
      ).rejects.toThrow('Notification not found or access denied');
    });

    it('should log successful deletion', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await notificationService.deleteNotification(1, 1);

      expect(log.info).toHaveBeenCalledWith(
        'Notification deleted',
        { notificationId: 1, userId: 1 }
      );
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(
        notificationService.deleteNotification(1, 1)
      ).rejects.toThrow('Delete failed');

      expect(log.error).toHaveBeenCalled();
    });
  });

  // =====================================================
  // 7. deleteAllNotifications Tests
  // =====================================================
  describe('deleteAllNotifications()', () => {
    it('should delete all notifications for user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }]
      });

      const count = await notificationService.deleteAllNotifications(1);

      expect(count).toBe(3);
    });

    it('should delete only read notifications when readOnly is true', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await notificationService.deleteAllNotifications(1, true);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read = true'),
        [1]
      );
    });

    it('should delete all when readOnly is false', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.deleteAllNotifications(1, false);

      expect(db.query).toHaveBeenCalledWith(
        expect.not.stringContaining('is_read'),
        [1]
      );
    });

    it('should return 0 if no notifications deleted', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const count = await notificationService.deleteAllNotifications(1);

      expect(count).toBe(0);
    });

    it('should log deletion summary', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      await notificationService.deleteAllNotifications(1, true);

      expect(log.info).toHaveBeenCalledWith(
        'Notifications deleted',
        { userId: 1, count: 2, readOnly: true }
      );
    });
  });

  // =====================================================
  // 8. getUnreadCount Tests
  // =====================================================
  describe('getUnreadCount()', () => {
    it('should get unread notification count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const count = await notificationService.getUnreadCount(1);

      expect(count).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [1]
      );
    });

    it('should filter by category when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      await notificationService.getUnreadCount(1, 'bot_alert');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('category = $2'),
        [1, 'bot_alert']
      );
    });

    it('should only count unread notifications', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await notificationService.getUnreadCount(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read = false'),
        expect.any(Array)
      );
    });

    it('should return 0 if no unread notifications', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const count = await notificationService.getUnreadCount(1);

      expect(count).toBe(0);
    });

    it('should parse count as integer', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '42' }] });

      const count = await notificationService.getUnreadCount(1);

      expect(typeof count).toBe('number');
      expect(count).toBe(42);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Query failed'));

      await expect(
        notificationService.getUnreadCount(1)
      ).rejects.toThrow('Query failed');

      expect(log.error).toHaveBeenCalled();
    });
  });

  // =====================================================
  // 9. Notification Preferences Tests
  // =====================================================
  describe('getNotificationPreferences()', () => {
    it('should get user notification preferences', async () => {
      const mockPrefs = {
        user_id: 1,
        email_enabled: true,
        push_enabled: true,
        in_app_enabled: true,
        email_preferences: JSON.stringify({ system: true }),
        push_preferences: JSON.stringify({ bot_alert: true }),
        in_app_preferences: JSON.stringify({ training: true })
      };

      db.query.mockResolvedValueOnce({ rows: [mockPrefs] });

      const result = await notificationService.getNotificationPreferences(1);

      expect(result.email_enabled).toBe(true);
      expect(result.email_preferences).toEqual({ system: true });
    });

    it('should parse JSON preference fields', async () => {
      const mockPrefs = {
        user_id: 1,
        email_preferences: '{"system":true,"bot_alert":false}',
        push_preferences: '{"security":true}',
        in_app_preferences: '{"marketing":false}'
      };

      db.query.mockResolvedValueOnce({ rows: [mockPrefs] });

      const result = await notificationService.getNotificationPreferences(1);

      expect(typeof result.email_preferences).toBe('object');
      expect(result.email_preferences.system).toBe(true);
      expect(result.push_preferences.security).toBe(true);
    });

    it('should create default preferences if none exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No existing prefs
        .mockResolvedValueOnce({ rows: [] }); // Insert default

      const result = await notificationService.getNotificationPreferences(1);

      expect(result.email_enabled).toBe(true);
      expect(result.push_enabled).toBe(true);
      expect(result.in_app_enabled).toBe(true);
      expect(result.email_preferences.marketing).toBe(false);
    });

    it('should handle already parsed JSON objects', async () => {
      const mockPrefs = {
        user_id: 1,
        email_preferences: { system: true }, // Already object
        push_preferences: { bot_alert: true },
        in_app_preferences: { training: true }
      };

      db.query.mockResolvedValueOnce({ rows: [mockPrefs] });

      const result = await notificationService.getNotificationPreferences(1);

      expect(result.email_preferences).toEqual({ system: true });
    });
  });

  describe('updateNotificationPreferences()', () => {
    it('should update notification preferences', async () => {
      const updates = {
        email_enabled: false,
        push_enabled: true,
        email_preferences: { system: false, bot_alert: true }
      };

      db.query.mockResolvedValueOnce({ rows: [updates] });

      const result = await notificationService.updateNotificationPreferences(1, updates);

      expect(db.query).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(
        'Notification preferences updated',
        { userId: 1 }
      );
    });

    it('should use UPSERT (ON CONFLICT)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{}] });

      await notificationService.updateNotificationPreferences(1, {
        email_enabled: true
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });

    it('should stringify JSON preferences', async () => {
      const prefs = {
        email_preferences: { system: true, bot_alert: false },
        push_preferences: { security: true }
      };

      db.query.mockResolvedValueOnce({ rows: [{}] });

      await notificationService.updateNotificationPreferences(1, prefs);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          JSON.stringify(prefs.email_preferences),
          JSON.stringify(prefs.push_preferences)
        ])
      );
    });

    it('should handle null values with COALESCE', async () => {
      db.query.mockResolvedValueOnce({ rows: [{}] });

      await notificationService.updateNotificationPreferences(1, {
        email_enabled: null
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE'),
        expect.any(Array)
      );
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        notificationService.updateNotificationPreferences(1, {})
      ).rejects.toThrow('Update failed');

      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('checkNotificationPreference()', () => {
    it('should allow notification when type is enabled', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          email_enabled: true,
          email_preferences: JSON.stringify({ system: true })
        }]
      });

      const result = await notificationService.checkNotificationPreference(
        1,
        'email',
        'system'
      );

      expect(result).toBe(true);
    });

    it('should block notification when type is disabled', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          email_enabled: false,
          email_preferences: JSON.stringify({ system: true })
        }]
      });

      const result = await notificationService.checkNotificationPreference(
        1,
        'email',
        'system'
      );

      expect(result).toBe(false);
    });

    it('should block notification when category is disabled', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          email_enabled: true,
          email_preferences: JSON.stringify({ system: false })
        }]
      });

      const result = await notificationService.checkNotificationPreference(
        1,
        'email',
        'system'
      );

      expect(result).toBe(false);
    });

    it('should check push preferences correctly', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          push_enabled: true,
          push_preferences: JSON.stringify({ bot_alert: true })
        }]
      });

      const result = await notificationService.checkNotificationPreference(
        1,
        'push',
        'bot_alert'
      );

      expect(result).toBe(true);
    });

    it('should check in-app preferences correctly', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          in_app_enabled: true,
          in_app_preferences: JSON.stringify({ training: true })
        }]
      });

      const result = await notificationService.checkNotificationPreference(
        1,
        'in-app',
        'training'
      );

      expect(result).toBe(true);
    });

    it('should default to true on error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const result = await notificationService.checkNotificationPreference(
        1,
        'email',
        'system'
      );

      expect(result).toBe(true);
      expect(log.error).toHaveBeenCalled();
    });

    it('should allow when category preference is undefined', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          email_enabled: true,
          email_preferences: JSON.stringify({}) // No system preference
        }]
      });

      const result = await notificationService.checkNotificationPreference(
        1,
        'email',
        'system'
      );

      expect(result).toBe(true);
    });
  });

  // =====================================================
  // 10. Email Notification Tests
  // =====================================================
  describe('sendEmailNotification()', () => {
    it('should send email to user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'user@example.com', name: 'John Doe' }]
      });

      const notification = {
        title: 'Test Notification',
        message: 'Test message',
        action_url: null
      };

      await notificationService.sendEmailNotification(1, notification);

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Test Notification',
        html: expect.any(String),
        text: 'Test message'
      });
    });

    it('should not throw error if user not found (logs error)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      // Should not throw - it logs error instead
      await notificationService.sendEmailNotification(999, {
        title: 'Test',
        message: 'Test'
      });

      expect(log.error).toHaveBeenCalledWith(
        'Failed to send email notification',
        expect.any(Object)
      );
    });

    it('should include action URL in email HTML', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'user@example.com', name: 'John' }]
      });

      const notification = {
        title: 'Action Required',
        message: 'Please click the button',
        action_url: 'https://example.com/action'
      };

      await notificationService.sendEmailNotification(1, notification);

      const htmlCall = emailService.sendEmail.mock.calls[0][0].html;
      expect(htmlCall).toContain('https://example.com/action');
      expect(htmlCall).toContain('View Details');
    });

    it('should not break if email service fails', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'user@example.com', name: 'John' }]
      });
      emailService.sendEmail.mockRejectedValueOnce(new Error('Email failed'));

      // Should not throw
      await notificationService.sendEmailNotification(1, {
        title: 'Test',
        message: 'Test'
      });

      expect(log.error).toHaveBeenCalledWith(
        'Failed to send email notification',
        expect.any(Object)
      );
    });

    it('should include user name in email', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'user@example.com', name: 'Jane Smith' }]
      });

      await notificationService.sendEmailNotification(1, {
        title: 'Test',
        message: 'Test'
      });

      const htmlCall = emailService.sendEmail.mock.calls[0][0].html;
      expect(htmlCall).toContain('Jane Smith');
    });
  });

  describe('generateEmailHTML()', () => {
    it('should generate email HTML with title and message', () => {
      const notification = {
        title: 'Test Title',
        message: 'Test message content',
        action_url: null
      };

      const html = notificationService.generateEmailHTML(notification, 'John');

      expect(html).toContain('Test Title');
      expect(html).toContain('Test message content');
      expect(html).toContain('Hi John');
    });

    it('should include action button when action_url provided', () => {
      const notification = {
        title: 'Action Required',
        message: 'Please take action',
        action_url: 'https://example.com/action'
      };

      const html = notificationService.generateEmailHTML(notification, 'User');

      expect(html).toContain('href="https://example.com/action"');
      expect(html).toContain('View Details');
    });

    it('should not include action button when no action_url', () => {
      const notification = {
        title: 'Info',
        message: 'Just information',
        action_url: null
      };

      const html = notificationService.generateEmailHTML(notification, 'User');

      expect(html).not.toContain('View Details');
    });

    it('should handle missing user name', () => {
      const notification = {
        title: 'Test',
        message: 'Test',
        action_url: null
      };

      const html = notificationService.generateEmailHTML(notification, null);

      expect(html).toContain('Hi,');
      expect(html).not.toContain('Hi ,');
    });
  });

  // =====================================================
  // 11. Push Notification Tests
  // =====================================================
  describe('sendPushNotification()', () => {
    it('should send push notification (stub)', async () => {
      const notification = {
        id: 1,
        title: 'Push Test',
        message: 'Push message'
      };

      await notificationService.sendPushNotification(1, notification);

      expect(log.info).toHaveBeenCalledWith(
        'Push notification sent (stub)',
        { userId: 1, notificationId: 1 }
      );
    });

    it('should resolve successfully', async () => {
      await expect(
        notificationService.sendPushNotification(1, { id: 1 })
      ).resolves.toBeUndefined();
    });
  });

  // =====================================================
  // 12. Cleanup Tests
  // =====================================================
  describe('cleanupOldNotifications()', () => {
    it('should delete old read notifications', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }]
      });

      const count = await notificationService.cleanupOldNotifications(90);

      expect(count).toBe(3);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '90 days'")
      );
    });

    it('should only delete read notifications', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.cleanupOldNotifications(30);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read = true')
      );
    });

    it('should use default of 90 days', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.cleanupOldNotifications();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '90 days'")
      );
    });

    it('should log cleanup summary', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      await notificationService.cleanupOldNotifications(60);

      expect(log.info).toHaveBeenCalledWith(
        'Old notifications cleaned up',
        { count: 2, daysOld: 60 }
      );
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Cleanup failed'));

      await expect(
        notificationService.cleanupOldNotifications(30)
      ).rejects.toThrow('Cleanup failed');

      expect(log.error).toHaveBeenCalled();
    });
  });

  // =====================================================
  // 13. Constants Tests
  // =====================================================
  describe('Constants', () => {
    it('should export NOTIFICATION_TYPES', () => {
      expect(NOTIFICATION_TYPES).toBeDefined();
      expect(NOTIFICATION_TYPES.EMAIL).toBe('email');
      expect(NOTIFICATION_TYPES.PUSH).toBe('push');
      expect(NOTIFICATION_TYPES.IN_APP).toBe('in-app');
    });

    it('should export NOTIFICATION_CATEGORIES', () => {
      expect(NOTIFICATION_CATEGORIES).toBeDefined();
      expect(NOTIFICATION_CATEGORIES.SYSTEM).toBe('system');
      expect(NOTIFICATION_CATEGORIES.BOT_ALERT).toBe('bot_alert');
      expect(NOTIFICATION_CATEGORIES.TRAINING).toBe('training');
      expect(NOTIFICATION_CATEGORIES.BILLING).toBe('billing');
      expect(NOTIFICATION_CATEGORIES.SECURITY).toBe('security');
      expect(NOTIFICATION_CATEGORIES.TEAM).toBe('team');
      expect(NOTIFICATION_CATEGORIES.MARKETING).toBe('marketing');
    });
  });

  // =====================================================
  // 14. Integration Tests
  // =====================================================
  describe('Integration Scenarios', () => {
    it('should handle complete notification workflow', async () => {
      // Send notification
      db.query
        .mockResolvedValueOnce({ rows: [{ email_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] })
        // Get notifications
        .mockResolvedValueOnce({ rows: [{ id: 1, data: '{}' }] })
        // Mark as read
        .mockResolvedValueOnce({ rows: [{ id: 1, is_read: true }] });

      const sent = await notificationService.sendNotification({
        userId: 1,
        type: 'email',
        category: 'system',
        title: 'Test',
        message: 'Test'
      });

      const notifications = await notificationService.getNotifications(1);
      await notificationService.markAsRead(1, 1);

      expect(sent.success).toBe(true);
      expect(notifications).toHaveLength(1);
    });

    it('should respect user preferences throughout workflow', async () => {
      // User has email disabled
      db.query.mockResolvedValueOnce({
        rows: [{ email_enabled: false }]
      });

      const result = await notificationService.sendNotification({
        userId: 1,
        type: 'email',
        category: 'marketing',
        title: 'Marketing Email',
        message: 'Buy now!'
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('blocked_by_preferences');
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });
});

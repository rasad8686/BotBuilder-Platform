/**
 * RecoveryMessagingService Tests
 * Tests for multi-channel recovery message delivery
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

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'email-123' })
  }))
}));

global.fetch = jest.fn();

const db = require('../../../db');
const RecoveryMessagingService = require('../../../services/recoveryEngine/RecoveryMessagingService');

describe('RecoveryMessagingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('sendRecoveryMessage', () => {
    it('should send email message successfully', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await RecoveryMessagingService.sendRecoveryMessage({
        message_id: 'msg-1',
        to_email: 'test@example.com',
        subject: 'Test Subject',
        body: '<p>Test body</p>'
      }, 'email');

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.external_id).toBe('email-123');
    });

    it('should track message delivery on success', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await RecoveryMessagingService.sendRecoveryMessage({
        message_id: 'msg-1',
        to_email: 'test@example.com',
        subject: 'Test',
        body: 'Test'
      }, 'email');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recovery_messages'),
        expect.any(Array)
      );
    });

    it('should handle send failure', async () => {
      const mockService = require('../../../services/recoveryEngine/RecoveryMessagingService');
      jest.spyOn(mockService, 'sendEmailMessage').mockResolvedValue({
        success: false,
        error: 'Send failed',
        channel: 'email'
      });

      db.query.mockResolvedValue({ rows: [] });

      const result = await mockService.sendRecoveryMessage({
        message_id: 'msg-1',
        to_email: 'test@example.com',
        subject: 'Test',
        body: 'Test'
      }, 'email');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should throw error for unsupported channel', async () => {
      const result = await RecoveryMessagingService.sendRecoveryMessage({
        message_id: 'msg-1',
        to: 'test@example.com'
      }, 'unsupported');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported channel');
    });
  });

  describe('sendWhatsAppMessage', () => {
    beforeEach(() => {
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-123';
      process.env.WHATSAPP_ACCESS_TOKEN = 'token-123';
    });

    afterEach(() => {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      delete process.env.WHATSAPP_ACCESS_TOKEN;
    });

    it('should send WhatsApp message successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'wa-msg-123' }] })
      });

      const result = await RecoveryMessagingService.sendWhatsAppMessage(
        '+1234567890',
        'cart_recovery',
        { customer_name: 'John', cart_total: '100' }
      );

      expect(result.success).toBe(true);
      expect(result.external_id).toBe('wa-msg-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer token-123'
          })
        })
      );
    });

    it('should format phone number correctly', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'wa-msg-123' }] })
      });

      await RecoveryMessagingService.sendWhatsAppMessage('1234567890', 'test', {});

      const callArgs = global.fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.to).toMatch(/^\+/);
    });

    it('should handle API errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'Invalid template' } })
      });

      const result = await RecoveryMessagingService.sendWhatsAppMessage('+1234567890', 'invalid', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid template');
    });

    it('should throw error when not configured', async () => {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;

      const result = await RecoveryMessagingService.sendWhatsAppMessage('+1234567890', 'test', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('sendEmailMessage', () => {
    it('should send plain email', async () => {
      const result = await RecoveryMessagingService.sendEmailMessage(
        'test@example.com',
        'Test Subject',
        '<p>Test body</p>'
      );

      expect(result.success).toBe(true);
      expect(result.external_id).toBe('email-123');
    });

    it('should render email template', async () => {
      const result = await RecoveryMessagingService.sendEmailMessage(
        'test@example.com',
        'Test Subject',
        'Test body',
        'cart_recovery'
      );

      expect(result.success).toBe(true);
    });

    it('should handle email errors', async () => {
      const nodemailer = require('nodemailer');
      nodemailer.createTransport.mockReturnValueOnce({
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP error'))
      });

      // Recreate service to get new transporter
      const mockService = require('../../../services/recoveryEngine/RecoveryMessagingService');

      const result = await mockService.sendEmailMessage('test@example.com', 'Test', 'Test');

      expect(result.success).toBe(false);
    });
  });

  describe('sendSMSMessage', () => {
    beforeEach(() => {
      process.env.TWILIO_ACCOUNT_SID = 'AC123';
      process.env.TWILIO_AUTH_TOKEN = 'token123';
      process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    });

    afterEach(() => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_PHONE_NUMBER;
    });

    it('should send SMS successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SMS123' })
      });

      const result = await RecoveryMessagingService.sendSMSMessage('+1234567890', 'Test message');

      expect(result.success).toBe(true);
      expect(result.external_id).toBe('SMS123');
    });

    it('should use Twilio API correctly', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SMS123' })
      });

      await RecoveryMessagingService.sendSMSMessage('+1234567890', 'Test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('Accounts/AC123/Messages.json'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should handle Twilio errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid phone number' })
      });

      const result = await RecoveryMessagingService.sendSMSMessage('+invalid', 'Test');

      expect(result.success).toBe(false);
    });

    it('should throw error when not configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;

      const result = await RecoveryMessagingService.sendSMSMessage('+1234567890', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('sendTelegramMessage', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token-123';
    });

    afterEach(() => {
      delete process.env.TELEGRAM_BOT_TOKEN;
    });

    it('should send Telegram message successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      });

      const result = await RecoveryMessagingService.sendTelegramMessage('chat-123', 'Test message');

      expect(result.success).toBe(true);
      expect(result.external_id).toBe('123');
    });

    it('should send message with buttons', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 123 } })
      });

      const buttons = [[{ text: 'Click me', url: 'https://example.com' }]];

      await RecoveryMessagingService.sendTelegramMessage('chat-123', 'Test', buttons);

      const callArgs = global.fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.reply_markup).toBeDefined();
      expect(body.reply_markup.inline_keyboard).toBeDefined();
    });

    it('should handle Telegram API errors', async () => {
      global.fetch.mockResolvedValue({
        json: async () => ({ ok: false, description: 'Chat not found' })
      });

      const result = await RecoveryMessagingService.sendTelegramMessage('invalid', 'Test');

      expect(result.success).toBe(false);
    });

    it('should throw error when not configured', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;

      const result = await RecoveryMessagingService.sendTelegramMessage('chat-123', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('selectBestChannel', () => {
    it('should select channel based on engagement history', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { channel: 'email', total_sent: '10', opened: '3', clicked: '1', converted: '0' },
            { channel: 'whatsapp', total_sent: '5', opened: '5', clicked: '3', converted: '2' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ recipient_email: 'test@example.com', recipient_phone: '+1234567890' }]
        });

      const result = await RecoveryMessagingService.selectBestChannel('cust-1');

      expect(result.recommended_channel).toBe('whatsapp');
      expect(result.contact_info.has_email).toBe(true);
      expect(result.contact_info.has_phone).toBe(true);
    });

    it('should use default rates when no history', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ recipient_email: 'test@example.com', recipient_phone: '+1234567890' }]
        });

      const result = await RecoveryMessagingService.selectBestChannel('cust-1');

      expect(result.recommended_channel).toBe('whatsapp'); // Highest default open rate
      expect(result.channel_scores).toBeDefined();
    });

    it('should only recommend available channels', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ recipient_email: 'test@example.com', recipient_phone: null }]
        });

      const result = await RecoveryMessagingService.selectBestChannel('cust-1');

      expect(result.recommended_channel).toBe('email');
      expect(result.available_channels).not.toContain('whatsapp');
      expect(result.available_channels).not.toContain('sms');
    });

    it('should include fallback channel', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ recipient_email: 'test@example.com', recipient_phone: '+1234567890' }]
        });

      const result = await RecoveryMessagingService.selectBestChannel('cust-1');

      expect(result.fallback_channel).toBeDefined();
      expect(result.fallback_channel).not.toBe(result.recommended_channel);
    });

    it('should default to email on error', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const result = await RecoveryMessagingService.selectBestChannel('cust-1');

      expect(result.recommended_channel).toBe('email');
      expect(result.error).toBeDefined();
    });
  });

  describe('trackMessageDelivery', () => {
    it('should track sent status', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'msg-1', status: 'sent' }] });

      const result = await RecoveryMessagingService.trackMessageDelivery('msg-1', 'sent');

      expect(result.status).toBe('sent');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('sent_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });

    it('should track delivered status', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'msg-1', status: 'delivered' }] });

      const result = await RecoveryMessagingService.trackMessageDelivery('msg-1', 'delivered');

      expect(result.status).toBe('delivered');
    });

    it('should track bounced status with error', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'msg-1', status: 'bounced' }] });

      await RecoveryMessagingService.trackMessageDelivery('msg-1', 'bounced', 'Invalid email');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('error_message'),
        expect.arrayContaining(['bounced', 'Invalid email', 'msg-1'])
      );
    });

    it('should track failed status', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'msg-1', status: 'failed' }] });

      await RecoveryMessagingService.trackMessageDelivery('msg-1', 'failed', 'Send error');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['failed', 'Send error', 'msg-1'])
      );
    });

    it('should throw error for invalid status', async () => {
      await expect(RecoveryMessagingService.trackMessageDelivery('msg-1', 'invalid'))
        .rejects.toThrow('Invalid status');
    });
  });

  describe('trackMessageOpen', () => {
    it('should track message open', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 'msg-1', status: 'opened', opened_at: new Date() }]
      });

      const result = await RecoveryMessagingService.trackMessageOpen('msg-1');

      expect(result.status).toBe('opened');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('opened_at'),
        ['msg-1']
      );
    });

    it('should throw error when message not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(RecoveryMessagingService.trackMessageOpen('nonexistent'))
        .rejects.toThrow('Message not found');
    });
  });

  describe('trackMessageClick', () => {
    it('should track message click', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 'msg-1', status: 'clicked', clicked_at: new Date() }]
      });

      const result = await RecoveryMessagingService.trackMessageClick('msg-1', 'link-1');

      expect(result.status).toBe('clicked');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('clicked_at'),
        ['msg-1']
      );
    });

    it('should set opened_at if not already set', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 'msg-1', status: 'clicked' }]
      });

      await RecoveryMessagingService.trackMessageClick('msg-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP)'),
        expect.any(Array)
      );
    });
  });

  describe('trackConversion', () => {
    it('should track conversion and update related records', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'msg-1',
            status: 'converted',
            event_id: 'event-1',
            campaign_id: 'campaign-1',
            channel: 'email'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Update event
        .mockResolvedValueOnce({ rows: [] }); // Update campaign

      const result = await RecoveryMessagingService.trackConversion('msg-1', 100);

      expect(result.revenue).toBe(100);
      expect(result.message.status).toBe('converted');

      // Verify event update
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recovery_events'),
        expect.arrayContaining([100, 'email', 'event-1'])
      );

      // Verify campaign update
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recovery_campaigns'),
        expect.arrayContaining([100, 'campaign-1'])
      );
    });

    it('should throw error when message not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(RecoveryMessagingService.trackConversion('nonexistent', 100))
        .rejects.toThrow('Message not found');
    });
  });

  describe('getMessageStats', () => {
    it('should get message statistics by channel', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            {
              channel: 'email',
              total_sent: '100',
              delivered: '95',
              opened: '50',
              clicked: '20',
              converted: '5',
              bounced: '5',
              failed: '0',
              total_revenue: '500.00'
            },
            {
              channel: 'sms',
              total_sent: '50',
              delivered: '48',
              opened: '40',
              clicked: '15',
              converted: '8',
              bounced: '2',
              failed: '0',
              total_revenue: '800.00'
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_messages: '150',
            delivered: '143',
            opened: '90',
            clicked: '35',
            converted: '13',
            total_revenue: '1300.00',
            avg_conversion_value: '100.00'
          }]
        });

      const result = await RecoveryMessagingService.getMessageStats(1);

      expect(result.overall).toBeDefined();
      expect(result.overall.total_sent).toBe(150);
      expect(result.overall.converted).toBe(13);
      expect(result.by_channel).toBeDefined();
      expect(result.by_channel.email).toBeDefined();
      expect(result.by_channel.sms).toBeDefined();
    });

    it('should calculate rates correctly', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            channel: 'email',
            total_sent: '100',
            delivered: '90',
            opened: '45',
            clicked: '18',
            converted: '9',
            bounced: '10',
            failed: '0',
            total_revenue: '900.00'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_messages: '100',
            delivered: '90',
            opened: '45',
            clicked: '18',
            converted: '9',
            total_revenue: '900.00',
            avg_conversion_value: '100.00'
          }]
        });

      const result = await RecoveryMessagingService.getMessageStats(1);

      expect(result.overall.delivery_rate).toBe('90.00'); // 90/100
      expect(result.overall.open_rate).toBe('50.00'); // 45/90
      expect(result.overall.click_rate).toBe('40.00'); // 18/45
      expect(result.overall.conversion_rate).toBe('50.00'); // 9/18
    });

    it('should filter by campaign_id', async () => {
      db.query.mockResolvedValue({
        rows: [{
          channel: 'email',
          total_sent: '10',
          delivered: '10',
          opened: '5',
          clicked: '2',
          converted: '1',
          bounced: '0',
          failed: '0',
          total_revenue: '100.00'
        }]
      });

      await RecoveryMessagingService.getMessageStats(1, 'campaign-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND campaign_id = $2'),
        expect.arrayContaining([1, 'campaign-1'])
      );
    });

    it('should handle zero messages gracefully', async () => {
      db.query.mockResolvedValue({
        rows: [{
          total_messages: '0',
          delivered: '0',
          opened: '0',
          clicked: '0',
          converted: '0',
          total_revenue: '0',
          avg_conversion_value: '0'
        }]
      });

      const result = await RecoveryMessagingService.getMessageStats(1);

      expect(result.overall.delivery_rate).toBe(0);
      expect(result.overall.open_rate).toBe(0);
    });
  });
});

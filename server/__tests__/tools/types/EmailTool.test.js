/**
 * EmailTool Tests
 * Tests for server/tools/types/EmailTool.js
 */

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
    verify: jest.fn(),
    close: jest.fn()
  }))
}));

const nodemailer = require('nodemailer');
const EmailTool = require('../../../tools/types/EmailTool');

describe('EmailTool', () => {
  let emailTool;
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: 'test-message-id',
        accepted: ['test@test.com'],
        rejected: [],
        response: '250 OK'
      }),
      verify: jest.fn().mockResolvedValue(true),
      close: jest.fn()
    };
    nodemailer.createTransport.mockReturnValue(mockTransporter);
    emailTool = new EmailTool({ defaultFrom: 'sender@test.com' });
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      const tool = new EmailTool({ defaultFrom: 'test@test.com' });
      expect(tool.config.defaultFrom).toBe('test@test.com');
      expect(tool.transporter).toBeNull();
    });

    it('should initialize with empty config', () => {
      const tool = new EmailTool();
      expect(tool.config).toBeDefined();
      expect(tool.transporter).toBeNull();
    });
  });

  describe('getTransporter', () => {
    it('should create and cache transporter', () => {
      const smtpConfig = { host: 'smtp.test.com', port: 587 };

      const transporter1 = emailTool.getTransporter(smtpConfig);
      const transporter2 = emailTool.getTransporter(smtpConfig);

      expect(transporter1).toBe(transporter2);
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });

    it('should configure with auth', () => {
      const smtpConfig = {
        host: 'smtp.test.com',
        auth: { user: 'user', pass: 'pass' }
      };

      emailTool.getTransporter(smtpConfig);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { user: 'user', pass: 'pass' }
        })
      );
    });

    it('should configure secure connection', () => {
      const smtpConfig = {
        host: 'smtp.test.com',
        port: 465,
        secure: true
      };

      emailTool.getTransporter(smtpConfig);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true
        })
      );
    });
  });

  describe('execute', () => {
    const smtpConfig = { host: 'smtp.test.com' };

    it('should send email successfully', async () => {
      const result = await emailTool.execute({
        to: 'recipient@test.com',
        subject: 'Test Subject',
        text: 'Test body',
        smtp: smtpConfig
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should send HTML email', async () => {
      await emailTool.execute({
        to: 'recipient@test.com',
        subject: 'Test Subject',
        html: '<h1>Hello</h1>',
        smtp: smtpConfig
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<h1>Hello</h1>'
        })
      );
    });

    it('should throw error if SMTP not configured', async () => {
      await expect(emailTool.execute({
        to: 'recipient@test.com',
        subject: 'Test'
      })).rejects.toThrow('SMTP configuration is required');
    });

    it('should throw error if recipient missing', async () => {
      await expect(emailTool.execute({
        subject: 'Test',
        text: 'Body',
        smtp: smtpConfig
      })).rejects.toThrow('Recipient (to) is required');
    });

    it('should throw error if subject missing', async () => {
      await expect(emailTool.execute({
        to: 'test@test.com',
        text: 'Body',
        smtp: smtpConfig
      })).rejects.toThrow('Subject is required');
    });

    it('should throw error if no body', async () => {
      await expect(emailTool.execute({
        to: 'test@test.com',
        subject: 'Test',
        smtp: smtpConfig
      })).rejects.toThrow('Email body (text or html) is required');
    });

    it('should handle cc and bcc', async () => {
      await emailTool.execute({
        to: 'to@test.com',
        cc: 'cc@test.com',
        bcc: 'bcc@test.com',
        subject: 'Test',
        text: 'Body',
        smtp: smtpConfig
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: 'cc@test.com',
          bcc: 'bcc@test.com'
        })
      );
    });

    it('should handle replyTo', async () => {
      await emailTool.execute({
        to: 'to@test.com',
        replyTo: 'reply@test.com',
        subject: 'Test',
        text: 'Body',
        smtp: smtpConfig
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'reply@test.com'
        })
      );
    });

    it('should handle priority', async () => {
      await emailTool.execute({
        to: 'to@test.com',
        subject: 'Test',
        text: 'Body',
        priority: 'high',
        smtp: smtpConfig
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high'
        })
      );
    });

    it('should handle custom headers', async () => {
      await emailTool.execute({
        to: 'to@test.com',
        subject: 'Test',
        text: 'Body',
        headers: { 'X-Custom': 'value' },
        smtp: smtpConfig
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom': 'value' }
        })
      );
    });

    it('should handle attachments', async () => {
      await emailTool.execute({
        to: 'to@test.com',
        subject: 'Test',
        text: 'Body',
        attachments: [{ filename: 'test.txt', content: 'Hello' }],
        smtp: smtpConfig
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.any(Array)
        })
      );
    });

    it('should use template', async () => {
      await emailTool.execute({
        to: 'to@test.com',
        subject: 'Test',
        template: {
          html: '<h1>Hello {{name}}</h1>',
          text: 'Hello {{name}}'
        },
        templateData: { name: 'World' },
        smtp: smtpConfig
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<h1>Hello World</h1>',
          text: 'Hello World'
        })
      );
    });

    it('should handle send errors', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(emailTool.execute({
        to: 'to@test.com',
        subject: 'Test',
        text: 'Body',
        smtp: smtpConfig
      })).rejects.toThrow('Failed to send email');
    });
  });

  describe('formatRecipients', () => {
    it('should join array recipients', () => {
      const result = emailTool.formatRecipients(['a@test.com', 'b@test.com']);
      expect(result).toBe('a@test.com, b@test.com');
    });

    it('should return string as-is', () => {
      const result = emailTool.formatRecipients('a@test.com');
      expect(result).toBe('a@test.com');
    });
  });

  describe('processAttachments', () => {
    it('should process string attachment', () => {
      const result = emailTool.processAttachments(['base64content']);

      expect(result[0].filename).toBe('attachment');
      expect(result[0].content).toBe('base64content');
      expect(result[0].encoding).toBe('base64');
    });

    it('should process object attachment with content', () => {
      const result = emailTool.processAttachments([{
        filename: 'test.txt',
        content: 'Hello',
        encoding: 'utf-8'
      }]);

      expect(result[0].filename).toBe('test.txt');
      expect(result[0].content).toBe('Hello');
      expect(result[0].encoding).toBe('utf-8');
    });

    it('should process attachment with path', () => {
      const result = emailTool.processAttachments([{
        filename: 'file.txt',
        path: '/path/to/file'
      }]);

      expect(result[0].path).toBe('/path/to/file');
    });

    it('should process attachment with href', () => {
      const result = emailTool.processAttachments([{
        filename: 'file.txt',
        href: 'http://example.com/file'
      }]);

      expect(result[0].href).toBe('http://example.com/file');
    });

    it('should process attachment with cid', () => {
      const result = emailTool.processAttachments([{
        filename: 'image.png',
        content: 'base64',
        cid: 'logo@test.com',
        contentType: 'image/png'
      }]);

      expect(result[0].cid).toBe('logo@test.com');
      expect(result[0].contentType).toBe('image/png');
    });
  });

  describe('renderTemplate', () => {
    it('should render simple variables', () => {
      const result = emailTool.renderTemplate(
        { html: 'Hello {{name}}!', text: 'Hello {{name}}!' },
        { name: 'World' }
      );

      expect(result.html).toBe('Hello World!');
      expect(result.text).toBe('Hello World!');
    });

    it('should render nested variables', () => {
      const result = emailTool.renderTemplate(
        { html: 'Hi {{user.name}}!' },
        { user: { name: 'John' } }
      );

      expect(result.html).toBe('Hi John!');
    });

    it('should preserve unmatched variables', () => {
      const result = emailTool.renderTemplate(
        { html: 'Hello {{missing}}!' },
        {}
      );

      expect(result.html).toBe('Hello {{missing}}!');
    });

    it('should escape HTML in values', () => {
      const result = emailTool.renderTemplate(
        { html: 'Hello {{name}}!' },
        { name: '<script>alert(1)</script>' }
      );

      expect(result.html).toContain('&lt;script&gt;');
    });

    it('should handle null template strings', () => {
      const result = emailTool.renderTemplate(
        { html: null, text: null },
        { name: 'World' }
      );

      expect(result.html).toBeNull();
      expect(result.text).toBeNull();
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(emailTool.escapeHtml('&<>"\''))
        .toBe('&amp;&lt;&gt;&quot;&#39;');
    });

    it('should not modify safe text', () => {
      expect(emailTool.escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('verify', () => {
    it('should verify SMTP connection', async () => {
      const result = await emailTool.verify({ host: 'smtp.test.com' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('SMTP connection verified');
    });

    it('should return error on failed verification', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await emailTool.verify({ host: 'invalid.host' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('close', () => {
    it('should close transporter', () => {
      emailTool.getTransporter({ host: 'smtp.test.com' });
      emailTool.close();

      expect(mockTransporter.close).toHaveBeenCalled();
      expect(emailTool.transporter).toBeNull();
    });

    it('should do nothing if no transporter', () => {
      expect(() => emailTool.close()).not.toThrow();
    });
  });

  describe('static schemas', () => {
    it('should return input schema', () => {
      const schema = EmailTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('to');
      expect(schema.required).toContain('subject');
    });

    it('should return output schema', () => {
      const schema = EmailTool.getOutputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties.success).toBeDefined();
    });

    it('should return config schema', () => {
      const schema = EmailTool.getConfigSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties.smtp).toBeDefined();
    });
  });
});

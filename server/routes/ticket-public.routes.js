/**
 * Ticket Public Routes
 * Unauthenticated routes for customer portal and chatbot integration
 */

const express = require('express');
const router = express.Router();
const ticketService = require('../services/ticket.service');
const crypto = require('crypto');

// Generate access token for ticket
const generateAccessToken = (ticketId) => {
  return crypto.createHash('sha256')
    .update(ticketId + process.env.JWT_SECRET || 'secret')
    .digest('hex')
    .substring(0, 32);
};

// Verify access token
const verifyAccessToken = (ticketId, token) => {
  const expected = generateAccessToken(ticketId);
  return token === expected;
};

// ==================== Customer Portal ====================

/**
 * POST /api/public/tickets
 * Create ticket (no auth required, email required)
 */
router.post('/', async (req, res) => {
  try {
    const {
      workspace_id,
      subject,
      description,
      requester_email,
      requester_name,
      priority,
      category_id
    } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'subject is required' });
    }

    if (!requester_email) {
      return res.status(400).json({ error: 'requester_email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requester_email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const ticket = await ticketService.createTicket(workspace_id, {
      subject,
      description,
      requester_email,
      requester_name: requester_name || requester_email.split('@')[0],
      priority: priority || 'medium',
      category_id,
      source: 'web',
      actor_type: 'customer'
    });

    // Generate access token for this ticket
    const accessToken = generateAccessToken(ticket.id);

    res.status(201).json({
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at
      },
      accessToken
    });
  } catch (error) {
    console.error('POST /api/public/tickets error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/public/tickets/:id
 * Get ticket by ID (requires access token)
 */
router.get('/:id', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(401).json({ error: 'Access token is required' });
    }

    if (!verifyAccessToken(req.params.id, token)) {
      return res.status(403).json({ error: 'Invalid access token' });
    }

    // Get ticket without workspace restriction for public access
    const ticket = await require('../db')('tickets')
      .where('id', req.params.id)
      .first();

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get public comments only (no internal notes)
    const comments = await ticketService.getComments(ticket.id, false);

    // Return limited info for public access
    res.json({
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        resolved_at: ticket.resolved_at
      },
      comments: comments.map(c => ({
        id: c.id,
        author_type: c.author_type,
        author_name: c.author_name,
        body: c.body,
        created_at: c.created_at
      }))
    });
  } catch (error) {
    console.error('GET /api/public/tickets/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/public/tickets/:id/comments
 * Add customer comment to ticket
 */
router.post('/:id/comments', async (req, res) => {
  try {
    const { token, body, requester_email, requester_name } = req.body;

    if (!token) {
      return res.status(401).json({ error: 'Access token is required' });
    }

    if (!verifyAccessToken(req.params.id, token)) {
      return res.status(403).json({ error: 'Invalid access token' });
    }

    if (!body) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    const comment = await ticketService.addComment(req.params.id, {
      author_type: 'customer',
      author_email: requester_email,
      author_name: requester_name || requester_email?.split('@')[0],
      body,
      is_internal: false
    });

    res.status(201).json({
      comment: {
        id: comment.id,
        author_type: comment.author_type,
        author_name: comment.author_name,
        body: comment.body,
        created_at: comment.created_at
      }
    });
  } catch (error) {
    console.error('POST /api/public/tickets/:id/comments error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/public/tickets/lookup
 * Get tickets by email
 */
router.get('/lookup', async (req, res) => {
  try {
    const { email, workspace_id } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await ticketService.getTickets(workspace_id, {
      requester_email: email,
      limit: 50,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });

    // Generate access tokens for each ticket
    const tickets = result.tickets.map(t => ({
      id: t.id,
      ticket_number: t.ticket_number,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      created_at: t.created_at,
      updated_at: t.updated_at,
      accessToken: generateAccessToken(t.id)
    }));

    res.json({ tickets });
  } catch (error) {
    console.error('GET /api/public/tickets/lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/public/tickets/:id/satisfaction
 * Submit satisfaction rating
 */
router.post('/:id/satisfaction', async (req, res) => {
  try {
    const { token, rating, feedback } = req.body;

    if (!token) {
      return res.status(401).json({ error: 'Access token is required' });
    }

    if (!verifyAccessToken(req.params.id, token)) {
      return res.status(403).json({ error: 'Invalid access token' });
    }

    if (rating === undefined || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const satisfaction = await ticketService.submitRating(req.params.id, rating, feedback);

    res.json({
      success: true,
      satisfaction: {
        rating: satisfaction.rating,
        submitted_at: satisfaction.submitted_at
      }
    });
  } catch (error) {
    console.error('POST /api/public/tickets/:id/satisfaction error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== Chatbot Integration ====================

/**
 * POST /api/public/tickets/from-chat
 * Create ticket from chatbot conversation
 */
router.post('/from-chat', async (req, res) => {
  try {
    const {
      workspace_id,
      bot_id,
      chat_id,
      subject,
      description,
      requester_email,
      requester_name,
      priority,
      category_id,
      messages,
      metadata
    } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'subject is required' });
    }

    // Build description from messages if not provided
    let ticketDescription = description;
    if (!ticketDescription && messages && Array.isArray(messages)) {
      ticketDescription = messages.map(m =>
        `[${m.role || 'user'}] ${m.content}`
      ).join('\n\n');
    }

    const ticket = await ticketService.createTicket(workspace_id, {
      subject,
      description: ticketDescription,
      requester_email,
      requester_name,
      priority: priority || 'medium',
      category_id,
      source: 'chat',
      metadata: {
        bot_id,
        chat_id,
        ...metadata
      },
      actor_type: 'system'
    });

    // If messages provided, add them as initial comment
    if (messages && Array.isArray(messages) && messages.length > 0) {
      await ticketService.addComment(ticket.id, {
        author_type: 'system',
        author_name: 'Chatbot',
        body: 'Chat transcript:\n\n' + messages.map(m =>
          `**${m.role || 'user'}:** ${m.content}`
        ).join('\n\n'),
        is_internal: true
      });
    }

    res.status(201).json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status
      },
      accessToken: generateAccessToken(ticket.id)
    });
  } catch (error) {
    console.error('POST /api/public/tickets/from-chat error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/public/tickets/escalate
 * Escalate from chatbot to human agent
 */
router.post('/escalate', async (req, res) => {
  try {
    const {
      workspace_id,
      bot_id,
      chat_id,
      requester_email,
      requester_name,
      reason,
      messages
    } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    // Create escalation ticket
    const subject = reason || 'Escalation request from chatbot';

    let description = 'Customer requested human assistance.';
    if (messages && Array.isArray(messages)) {
      description += '\n\nChat transcript:\n' + messages.map(m =>
        `[${m.role || 'user'}] ${m.content}`
      ).join('\n\n');
    }

    const ticket = await ticketService.createTicket(workspace_id, {
      subject,
      description,
      requester_email,
      requester_name,
      priority: 'high', // Escalations are high priority
      source: 'chat',
      metadata: {
        bot_id,
        chat_id,
        escalation: true,
        escalation_reason: reason
      },
      actor_type: 'system'
    });

    // Try to auto-assign
    await ticketService.autoAssign(ticket.id, workspace_id);

    // Get updated ticket
    const updatedTicket = await ticketService.getTicketById(ticket.id, workspace_id);

    res.status(201).json({
      success: true,
      ticket: {
        id: updatedTicket.id,
        ticket_number: updatedTicket.ticket_number,
        subject: updatedTicket.subject,
        status: updatedTicket.status,
        assignee: updatedTicket.assignee ? {
          id: updatedTicket.assignee.id,
          name: updatedTicket.assignee.name
        } : null
      },
      accessToken: generateAccessToken(updatedTicket.id)
    });
  } catch (error) {
    console.error('POST /api/public/tickets/escalate error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/public/tickets/status/:ticketNumber
 * Quick status check by ticket number (limited info)
 */
router.get('/status/:ticketNumber', async (req, res) => {
  try {
    const { workspace_id } = req.query;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    const ticket = await ticketService.getTicketByNumber(req.params.ticketNumber, workspace_id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({
      ticket_number: ticket.ticket_number,
      status: ticket.status,
      priority: ticket.priority,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at
    });
  } catch (error) {
    console.error('GET /api/public/tickets/status/:ticketNumber error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Customer Portal (Extended) ====================

/**
 * GET /api/public/tickets/portal/:workspaceSlug/config
 * Get portal configuration
 */
router.get('/portal/:workspaceSlug/config', async (req, res) => {
  try {
    const { workspaceSlug } = req.params;

    // In production, fetch from database
    const config = {
      workspaceId: 'ws_' + workspaceSlug,
      name: 'Support Center',
      description: 'How can we help you today?',
      logo: null,
      primaryColor: '#7c3aed',
      categories: [
        { id: 'general', name: 'General Inquiry' },
        { id: 'technical', name: 'Technical Support' },
        { id: 'billing', name: 'Billing Question' },
        { id: 'feature', name: 'Feature Request' },
        { id: 'bug', name: 'Bug Report' },
      ],
      features: {
        ticketSubmission: true,
        knowledgeBase: true,
        livechat: false,
      },
    };

    res.json(config);
  } catch (error) {
    console.error('GET /portal/:workspaceSlug/config error:', error);
    res.status(500).json({ error: 'Failed to fetch portal configuration' });
  }
});

/**
 * POST /api/public/tickets/portal/:workspaceSlug/submit
 * Submit ticket via portal
 */
router.post('/portal/:workspaceSlug/submit', async (req, res) => {
  try {
    const { workspaceSlug } = req.params;
    const { name, email, subject, category, priority, description } = req.body;

    // Validation
    if (!name || !email || !subject || !description) {
      return res.status(400).json({ error: 'Name, email, subject, and description are required' });
    }

    // Get workspace by slug (in production)
    // const workspace = await Workspace.findBySlug(workspaceSlug);

    const ticket = await ticketService.createTicket(workspaceSlug, {
      subject,
      description,
      requester_email: email,
      requester_name: name,
      priority: priority || 'medium',
      category_id: category,
      source: 'portal',
      actor_type: 'customer'
    });

    const accessToken = generateAccessToken(ticket.id);

    res.status(201).json({
      ticket: {
        id: ticket.id,
        number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.created_at,
      },
      accessToken,
    });
  } catch (error) {
    console.error('POST /portal/:workspaceSlug/submit error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/public/tickets/portal/my-tickets
 * Get customer's tickets (requires portal token)
 */
router.get('/portal/my-tickets', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Verify token (in production, use JWT)
    // const decoded = jwt.verify(token, JWT_SECRET);

    // Mock response
    res.json({
      email: 'customer@example.com',
      tickets: [],
    });
  } catch (error) {
    console.error('GET /portal/my-tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// ==================== Widget Endpoints ====================

/**
 * GET /api/public/tickets/widget/:workspaceId/config
 * Get widget configuration
 */
router.get('/widget/:workspaceId/config', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const config = {
      name: 'Support',
      primaryColor: '#7c3aed',
      logo: null,
      categories: [
        { id: 'general', name: 'General Inquiry' },
        { id: 'technical', name: 'Technical Support' },
        { id: 'billing', name: 'Billing' },
        { id: 'other', name: 'Other' },
      ],
    };

    res.json(config);
  } catch (error) {
    console.error('GET /widget/:workspaceId/config error:', error);
    res.status(500).json({ error: 'Failed to fetch widget configuration' });
  }
});

/**
 * POST /api/public/tickets/widget/:workspaceId/submit
 * Submit ticket via widget
 */
router.post('/widget/:workspaceId/submit', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, email, subject, category, description } = req.body;

    if (!name || !email || !subject || !description) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const ticket = await ticketService.createTicket(workspaceId, {
      subject,
      description,
      requester_email: email,
      requester_name: name,
      category_id: category,
      priority: 'medium',
      source: 'widget',
      actor_type: 'customer'
    });

    res.status(201).json({
      ticket: {
        id: ticket.id,
        number: ticket.ticket_number,
        subject: ticket.subject,
      },
    });
  } catch (error) {
    console.error('POST /widget/:workspaceId/submit error:', error);
    res.status(500).json({ error: 'Failed to submit ticket' });
  }
});

// ==================== Email Verification ====================

// In-memory store for verification codes (use Redis in production)
const verificationCodes = new Map();

/**
 * POST /api/public/tickets/auth/request-code
 * Request email verification code
 */
router.post('/auth/request-code', async (req, res) => {
  try {
    const { email, workspaceId } = req.body;

    if (!email || !workspaceId) {
      return res.status(400).json({ error: 'Email and workspaceId are required' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    verificationCodes.set(`${workspaceId}:${email}`, {
      code,
      expiresAt,
      attempts: 0,
    });

    // In production, send email
    console.log(`Verification code for ${email}: ${code}`);

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('POST /auth/request-code error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * POST /api/public/tickets/auth/verify-code
 * Verify email code
 */
router.post('/auth/verify-code', async (req, res) => {
  try {
    const { email, code, workspaceId } = req.body;

    if (!email || !code || !workspaceId) {
      return res.status(400).json({ error: 'Email, code, and workspaceId are required' });
    }

    const key = `${workspaceId}:${email}`;
    const stored = verificationCodes.get(key);

    if (!stored) {
      return res.status(400).json({ error: 'No verification code found' });
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(key);
      return res.status(400).json({ error: 'Code expired' });
    }

    if (stored.attempts >= 5) {
      verificationCodes.delete(key);
      return res.status(400).json({ error: 'Too many attempts' });
    }

    if (stored.code !== code) {
      stored.attempts++;
      return res.status(400).json({ error: 'Invalid code' });
    }

    verificationCodes.delete(key);

    // Generate access token
    const accessToken = crypto.createHash('sha256')
      .update(email + workspaceId + process.env.JWT_SECRET || 'secret')
      .digest('hex');

    res.json({
      accessToken,
      email,
      tickets: [],
    });
  } catch (error) {
    console.error('POST /auth/verify-code error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

module.exports = router;

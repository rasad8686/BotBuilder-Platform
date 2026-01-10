/**
 * Ticket API Routes
 * Authenticated routes for helpdesk/ticket management
 */

const express = require('express');
const router = express.Router();
const ticketService = require('../services/ticket.service');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Get workspace ID from user
const getWorkspaceId = (req) => {
  return req.query.workspace_id ||
         req.body.workspace_id ||
         req.user?.workspace_id ||
         req.user?.organization_id ||
         req.user?.org_id ||
         req.user?.id ||
         1;
};

// ==================== Tickets CRUD ====================

/**
 * GET /api/tickets
 * List tickets with filters and pagination
 */
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const {
      status,
      priority,
      assignee_id,
      category_id,
      requester_email,
      search,
      tags,
      source,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const result = await ticketService.getTickets(workspaceId, {
      status: status ? status.split(',') : undefined,
      priority: priority ? priority.split(',') : undefined,
      assignee_id,
      category_id,
      requester_email,
      search,
      tags: tags ? tags.split(',') : undefined,
      source,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    });

    res.json(result);
  } catch (error) {
    console.error('GET /api/tickets error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets
 * Create new ticket
 */
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);

    const ticket = await ticketService.createTicket(workspaceId, {
      ...req.body,
      actor_type: 'agent',
      actor_id: req.user?.id,
      actor_name: req.user?.name
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('POST /api/tickets error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/number/:ticketNumber
 * Get ticket by number
 */
router.get('/number/:ticketNumber', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const ticket = await ticketService.getTicketByNumber(req.params.ticketNumber, workspaceId);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('GET /api/tickets/number/:ticketNumber error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Categories (MUST be before /:id) ====================

/**
 * GET /api/tickets/categories
 * Get categories
 */
router.get('/categories', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const categories = await ticketService.getCategories(workspaceId);
    res.json({ categories });
  } catch (error) {
    console.error('GET /api/tickets/categories error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/categories
 * Create category
 */
router.post('/categories', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const category = await ticketService.createCategory(workspaceId, req.body);
    res.status(201).json(category);
  } catch (error) {
    console.error('POST /api/tickets/categories error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/categories/:id
 * Update category
 */
router.put('/categories/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const category = await ticketService.updateCategory(req.params.id, workspaceId, req.body);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('PUT /api/tickets/categories/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/categories/:id
 * Delete category
 */
router.delete('/categories/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const deleted = await ticketService.deleteCategory(req.params.id, workspaceId);

    if (!deleted) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/tickets/categories/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SLA Policies (MUST be before /:id) ====================

/**
 * GET /api/tickets/sla-policies
 * Get SLA policies
 */
router.get('/sla-policies', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const policies = await ticketService.getSLAPolicies(workspaceId);
    res.json({ policies });
  } catch (error) {
    console.error('GET /api/tickets/sla-policies error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/sla-policies
 * Create SLA policy
 */
router.post('/sla-policies', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const policy = await ticketService.createSLAPolicy(workspaceId, req.body);
    res.status(201).json(policy);
  } catch (error) {
    console.error('POST /api/tickets/sla-policies error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/sla-policies/:id
 * Update SLA policy
 */
router.put('/sla-policies/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const policy = await ticketService.updateSLAPolicy(req.params.id, workspaceId, req.body);

    if (!policy) {
      return res.status(404).json({ error: 'SLA policy not found' });
    }

    res.json(policy);
  } catch (error) {
    console.error('PUT /api/tickets/sla-policies/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/sla-policies/:id
 * Delete SLA policy
 */
router.delete('/sla-policies/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const deleted = await ticketService.deleteSLAPolicy(req.params.id, workspaceId);

    if (!deleted) {
      return res.status(404).json({ error: 'SLA policy not found' });
    }

    res.json({ success: true, message: 'SLA policy deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/tickets/sla-policies/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Canned Responses (MUST be before /:id) ====================

/**
 * GET /api/tickets/canned-responses
 * Get canned responses
 */
router.get('/canned-responses', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { category, search, is_active } = req.query;

    const responses = await ticketService.getCannedResponses(workspaceId, {
      category,
      search,
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined
    });

    res.json({ responses });
  } catch (error) {
    console.error('GET /api/tickets/canned-responses error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/canned-responses
 * Create canned response
 */
router.post('/canned-responses', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const response = await ticketService.createCannedResponse(workspaceId, {
      ...req.body,
      created_by: req.user?.id
    });
    res.status(201).json(response);
  } catch (error) {
    console.error('POST /api/tickets/canned-responses error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/canned-responses/:id
 * Update canned response
 */
router.put('/canned-responses/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const response = await ticketService.updateCannedResponse(req.params.id, workspaceId, req.body);

    if (!response) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    res.json(response);
  } catch (error) {
    console.error('PUT /api/tickets/canned-responses/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/canned-responses/:id
 * Delete canned response
 */
router.delete('/canned-responses/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const deleted = await ticketService.deleteCannedResponse(req.params.id, workspaceId);

    if (!deleted) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    res.json({ success: true, message: 'Canned response deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/tickets/canned-responses/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/canned-responses/:id/use
 * Increment usage count
 */
router.post('/canned-responses/:id/use', async (req, res) => {
  try {
    await ticketService.incrementUsage(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/tickets/canned-responses/:id/use error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Analytics (MUST be before /:id) ====================

const ticketAnalyticsService = require('../services/ticket-analytics.service');

/**
 * GET /api/tickets/analytics/overview
 * Get ticket statistics overview
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { startDate, endDate } = req.query;

    const stats = await ticketService.getTicketStats(workspaceId, {
      startDate,
      endDate
    });

    res.json(stats);
  } catch (error) {
    console.error('GET /api/tickets/analytics/overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/agents
 * Get agent statistics
 */
router.get('/analytics/agents', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { agentId, startDate, endDate } = req.query;

    if (agentId) {
      const stats = await ticketService.getAgentStats(workspaceId, agentId, {
        startDate,
        endDate
      });
      res.json(stats);
    } else {
      res.json({ agents: [] });
    }
  } catch (error) {
    console.error('GET /api/tickets/analytics/agents error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/agents/performance
 * Get all agents performance
 */
router.get('/analytics/agents/performance', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate } = req.query;

    const agents = await ticketAnalyticsService.getAgentPerformance(workspaceId, {
      period,
      startDate,
      endDate
    });

    res.json({ agents });
  } catch (error) {
    console.error('GET /api/tickets/analytics/agents/performance error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/agents/:agentId
 * Get single agent performance details
 */
router.get('/analytics/agents/:agentId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate } = req.query;

    const performance = await ticketAnalyticsService.getAgentPerformanceById(
      workspaceId,
      req.params.agentId,
      { period, startDate, endDate }
    );

    res.json(performance);
  } catch (error) {
    console.error('GET /api/tickets/analytics/agents/:agentId error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/sla
 * Get SLA performance statistics
 */
router.get('/analytics/sla', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { startDate, endDate } = req.query;

    const performance = await ticketService.getSLAPerformance(workspaceId, {
      startDate,
      endDate
    });

    res.json(performance);
  } catch (error) {
    console.error('GET /api/tickets/analytics/sla error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/sla/detailed
 * Get detailed SLA performance
 */
router.get('/analytics/sla/detailed', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate } = req.query;

    const sla = await ticketAnalyticsService.getSLAPerformance(workspaceId, {
      period,
      startDate,
      endDate
    });

    res.json(sla);
  } catch (error) {
    console.error('GET /api/tickets/analytics/sla/detailed error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/satisfaction
 * Get satisfaction statistics
 */
router.get('/analytics/satisfaction', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { startDate, endDate } = req.query;

    const stats = await ticketService.getSatisfactionStats(workspaceId, {
      startDate,
      endDate
    });

    res.json(stats);
  } catch (error) {
    console.error('GET /api/tickets/analytics/satisfaction error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/detailed
 * Get detailed overview with trends
 */
router.get('/analytics/detailed', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate } = req.query;

    const stats = await ticketAnalyticsService.getOverviewStats(workspaceId, {
      period,
      startDate,
      endDate
    });

    res.json(stats);
  } catch (error) {
    console.error('GET /api/tickets/analytics/detailed error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/volume
 * Get ticket volume over time
 */
router.get('/analytics/volume', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate, groupBy = 'day' } = req.query;

    const volume = await ticketAnalyticsService.getTicketVolume(workspaceId, {
      period,
      startDate,
      endDate
    }, groupBy);

    res.json({ volume });
  } catch (error) {
    console.error('GET /api/tickets/analytics/volume error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/distribution
 * Get ticket distribution by dimension
 */
router.get('/analytics/distribution', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate, dimension = 'status' } = req.query;

    const distribution = await ticketAnalyticsService.getDistribution(workspaceId, {
      period,
      startDate,
      endDate
    }, dimension);

    res.json({ distribution });
  } catch (error) {
    console.error('GET /api/tickets/analytics/distribution error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/csat
 * Get CSAT metrics
 */
router.get('/analytics/csat', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate } = req.query;

    const csat = await ticketAnalyticsService.getCSATMetrics(workspaceId, {
      period,
      startDate,
      endDate
    });

    res.json(csat);
  } catch (error) {
    console.error('GET /api/tickets/analytics/csat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/peak-hours
 * Get peak hours heatmap
 */
router.get('/analytics/peak-hours', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate } = req.query;

    const heatmap = await ticketAnalyticsService.getPeakHours(workspaceId, {
      period,
      startDate,
      endDate
    });

    res.json({ heatmap });
  } catch (error) {
    console.error('GET /api/tickets/analytics/peak-hours error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/response-time
 * Get response time histogram
 */
router.get('/analytics/response-time', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate } = req.query;

    const histogram = await ticketAnalyticsService.getResponseTimeHistogram(workspaceId, {
      period,
      startDate,
      endDate
    });

    res.json(histogram);
  } catch (error) {
    console.error('GET /api/tickets/analytics/response-time error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/analytics/export
 * Export analytics data
 */
router.get('/analytics/export', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { period, startDate, endDate, format = 'csv' } = req.query;

    const data = await ticketAnalyticsService.exportAnalytics(workspaceId, {
      period,
      startDate,
      endDate
    }, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=ticket-analytics.csv');
      res.send(data);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('GET /api/tickets/analytics/export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GET /:id (MUST be after specific routes) ====================

/**
 * GET /api/tickets/:id
 * Get single ticket with details
 */
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const ticket = await ticketService.getTicketById(req.params.id, workspaceId);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('GET /api/tickets/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/:id
 * Update ticket
 */
router.put('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);

    const ticket = await ticketService.updateTicket(req.params.id, workspaceId, {
      ...req.body,
      actor_type: 'agent',
      actor_id: req.user?.id,
      actor_name: req.user?.name
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('PUT /api/tickets/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/:id
 * Delete ticket
 */
router.delete('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const deleted = await ticketService.deleteTicket(req.params.id, workspaceId);

    if (!deleted) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/tickets/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Status Management ====================

/**
 * POST /api/tickets/:id/resolve
 * Resolve ticket
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const ticket = await ticketService.resolveTicket(
      req.params.id,
      workspaceId,
      req.user?.id,
      req.user?.name
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('POST /api/tickets/:id/resolve error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/:id/close
 * Close ticket
 */
router.post('/:id/close', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const ticket = await ticketService.closeTicket(
      req.params.id,
      workspaceId,
      req.user?.id,
      req.user?.name
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('POST /api/tickets/:id/close error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/:id/reopen
 * Reopen ticket
 */
router.post('/:id/reopen', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const ticket = await ticketService.reopenTicket(
      req.params.id,
      workspaceId,
      req.user?.id,
      req.user?.name
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('POST /api/tickets/:id/reopen error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== Assignment ====================

/**
 * POST /api/tickets/:id/assign
 * Assign ticket to user
 */
router.post('/:id/assign', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { assigneeId } = req.body;

    if (!assigneeId) {
      return res.status(400).json({ error: 'assigneeId is required' });
    }

    const ticket = await ticketService.assignTicket(
      req.params.id,
      workspaceId,
      assigneeId,
      req.user?.id,
      req.user?.name
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('POST /api/tickets/:id/assign error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/:id/unassign
 * Unassign ticket
 */
router.post('/:id/unassign', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const ticket = await ticketService.unassignTicket(
      req.params.id,
      workspaceId,
      req.user?.id,
      req.user?.name
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('POST /api/tickets/:id/unassign error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/:id/auto-assign
 * Auto-assign ticket
 */
router.post('/:id/auto-assign', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const ticket = await ticketService.autoAssign(req.params.id, workspaceId);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found or no agents available' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('POST /api/tickets/:id/auto-assign error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== Comments ====================

/**
 * GET /api/tickets/:id/comments
 * Get comments for ticket
 */
router.get('/:id/comments', async (req, res) => {
  try {
    const includeInternal = req.query.includeInternal !== 'false';
    const comments = await ticketService.getComments(req.params.id, includeInternal);
    res.json({ comments });
  } catch (error) {
    console.error('GET /api/tickets/:id/comments error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/:id/comments
 * Add comment to ticket
 */
router.post('/:id/comments', async (req, res) => {
  try {
    const comment = await ticketService.addComment(req.params.id, {
      ...req.body,
      author_type: 'agent',
      author_id: req.user?.id?.toString(),
      author_name: req.user?.name,
      author_email: req.user?.email
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('POST /api/tickets/:id/comments error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/:id/comments/:commentId
 * Update comment
 */
router.put('/:id/comments/:commentId', async (req, res) => {
  try {
    const comment = await ticketService.updateComment(
      req.params.id,
      req.params.commentId,
      req.body
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(comment);
  } catch (error) {
    console.error('PUT /api/tickets/:id/comments/:commentId error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/:id/comments/:commentId
 * Delete comment
 */
router.delete('/:id/comments/:commentId', async (req, res) => {
  try {
    const deleted = await ticketService.deleteComment(req.params.id, req.params.commentId);

    if (!deleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/tickets/:id/comments/:commentId error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Activities ====================

/**
 * GET /api/tickets/:id/activities
 * Get activities for ticket
 */
router.get('/:id/activities', async (req, res) => {
  try {
    const activities = await ticketService.getActivities(req.params.id);
    res.json({ activities });
  } catch (error) {
    console.error('GET /api/tickets/:id/activities error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Merge ====================

/**
 * POST /api/tickets/:id/merge
 * Merge tickets into this one
 */
router.post('/:id/merge', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { ticketIds } = req.body;

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ error: 'ticketIds array is required' });
    }

    const ticket = await ticketService.mergeTickets(
      req.params.id,
      ticketIds,
      workspaceId,
      req.user?.id,
      req.user?.name
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('POST /api/tickets/:id/merge error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

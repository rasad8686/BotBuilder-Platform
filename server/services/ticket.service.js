/**
 * Ticket Service
 * Handles all helpdesk/ticket operations
 */

const db = require('../config/db');

class TicketService {
  // ==================== Ticket Number Generator ====================

  /**
   * Generate unique ticket number for workspace
   * Format: #1001, #1002, ...
   */
  async generateTicketNumber(workspaceId) {
    // Use transaction with row-level locking for concurrent safety
    const result = await db.transaction(async (trx) => {
      // Try to get and increment existing sequence
      const updated = await trx('ticket_sequences')
        .where('workspace_id', workspaceId)
        .increment('last_number', 1)
        .returning('last_number');

      if (updated.length > 0) {
        return updated[0].last_number;
      }

      // Create new sequence for workspace starting at 1001
      await trx('ticket_sequences').insert({
        workspace_id: workspaceId,
        last_number: 1001
      });

      return 1001;
    });

    return `#${result}`;
  }

  // ==================== Tickets CRUD ====================

  /**
   * Get tickets with filters and pagination
   */
  async getTickets(workspaceId, options = {}) {
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
    } = options;

    let query = db('tickets')
      .where('workspace_id', workspaceId);

    // Filters
    if (status) {
      if (Array.isArray(status)) {
        query = query.whereIn('status', status);
      } else {
        query = query.where('status', status);
      }
    }

    if (priority) {
      if (Array.isArray(priority)) {
        query = query.whereIn('priority', priority);
      } else {
        query = query.where('priority', priority);
      }
    }

    if (assignee_id) {
      query = query.where('assignee_id', assignee_id);
    }

    if (category_id) {
      query = query.where('category_id', category_id);
    }

    if (requester_email) {
      query = query.where('requester_email', requester_email);
    }

    if (source) {
      query = query.where('source', source);
    }

    if (tags && tags.length > 0) {
      query = query.whereRaw('tags && ?', [tags]);
    }

    if (search) {
      query = query.where(function() {
        this.whereILike('subject', `%${search}%`)
          .orWhereILike('description', `%${search}%`)
          .orWhereILike('ticket_number', `%${search}%`)
          .orWhereILike('requester_name', `%${search}%`)
          .orWhereILike('requester_email', `%${search}%`);
      });
    }

    // Count total
    const countResult = await query.clone().count('id as total').first();
    const total = parseInt(countResult?.total || 0);

    // Sort and paginate
    const offset = (page - 1) * limit;
    const tickets = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset(offset);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single ticket by ID with related data
   */
  async getTicketById(id, workspaceId) {
    const ticket = await db('tickets')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .first();

    if (!ticket) return null;

    // Get category
    if (ticket.category_id) {
      ticket.category = await db('ticket_categories')
        .where('id', ticket.category_id)
        .first();
    }

    // Get assignee
    if (ticket.assignee_id) {
      ticket.assignee = await db('users')
        .select('id', 'name', 'email')
        .where('id', ticket.assignee_id)
        .first();
    }

    // Get SLA policy
    if (ticket.sla_policy_id) {
      ticket.sla_policy = await db('sla_policies')
        .where('id', ticket.sla_policy_id)
        .first();
    }

    // Get SLA status
    ticket.sla_status = await this.getSLAStatus(id);

    return ticket;
  }

  /**
   * Get ticket by ticket number
   */
  async getTicketByNumber(ticketNumber, workspaceId) {
    const ticket = await db('tickets')
      .where('ticket_number', ticketNumber)
      .where('workspace_id', workspaceId)
      .first();

    if (!ticket) return null;

    return this.getTicketById(ticket.id, workspaceId);
  }

  /**
   * Create new ticket
   */
  async createTicket(workspaceId, data) {
    const ticketNumber = await this.generateTicketNumber(workspaceId);

    // Get default SLA policy if not specified
    let slaPolicyId = data.sla_policy_id;
    if (!slaPolicyId) {
      const defaultSLA = await db('sla_policies')
        .where('workspace_id', workspaceId)
        .where('is_default', true)
        .where('is_active', true)
        .first();
      slaPolicyId = defaultSLA?.id;
    }

    // Calculate due date based on SLA
    let dueAt = data.due_at;
    if (slaPolicyId && !dueAt) {
      const slaPolicy = await db('sla_policies').where('id', slaPolicyId).first();
      if (slaPolicy) {
        const resolutionMinutes = slaPolicy.priority_overrides?.[data.priority]?.resolution || slaPolicy.resolution_time;
        if (resolutionMinutes) {
          dueAt = new Date(Date.now() + resolutionMinutes * 60 * 1000);
        }
      }
    }

    const [ticket] = await db('tickets')
      .insert({
        workspace_id: workspaceId,
        ticket_number: ticketNumber,
        subject: data.subject,
        description: data.description,
        status: data.status || 'open',
        priority: data.priority || 'medium',
        category_id: data.category_id,
        requester_id: data.requester_id,
        requester_email: data.requester_email,
        requester_name: data.requester_name,
        assignee_id: data.assignee_id,
        team_id: data.team_id,
        source: data.source || 'web',
        sla_policy_id: slaPolicyId,
        due_at: dueAt,
        tags: data.tags || [],
        custom_fields: data.custom_fields || {},
        metadata: data.metadata || {}
      })
      .returning('*');

    // Log activity
    await this.logActivity(ticket.id, 'created', null, null, {
      actorType: data.actor_type || 'system',
      actorId: data.actor_id,
      actorName: data.actor_name
    });

    return ticket;
  }

  /**
   * Update ticket
   */
  async updateTicket(id, workspaceId, data) {
    const oldTicket = await db('tickets')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .first();

    if (!oldTicket) return null;

    const updateData = {
      updated_at: new Date()
    };

    // Track changes for activity log
    const changes = [];

    const allowedFields = [
      'subject', 'description', 'status', 'priority', 'category_id',
      'assignee_id', 'team_id', 'due_at', 'tags', 'custom_fields', 'metadata'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined && data[field] !== oldTicket[field]) {
        updateData[field] = data[field];
        changes.push({ field, oldValue: oldTicket[field], newValue: data[field] });
      }
    }

    // Handle status change timestamps
    if (updateData.status) {
      if (updateData.status === 'resolved' && oldTicket.status !== 'resolved') {
        updateData.resolved_at = new Date();
      }
      if (updateData.status === 'closed' && oldTicket.status !== 'closed') {
        updateData.closed_at = new Date();
      }
    }

    const [ticket] = await db('tickets')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .update(updateData)
      .returning('*');

    // Log activities for each change
    for (const change of changes) {
      await this.logActivity(id, `${change.field}_changed`, change.oldValue, change.newValue, {
        actorType: data.actor_type || 'agent',
        actorId: data.actor_id,
        actorName: data.actor_name
      });
    }

    return ticket;
  }

  /**
   * Delete ticket
   */
  async deleteTicket(id, workspaceId) {
    const deleted = await db('tickets')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .del();

    return deleted > 0;
  }

  // ==================== Status Management ====================

  /**
   * Change ticket status
   */
  async changeStatus(id, workspaceId, newStatus, actorId, actorName) {
    return this.updateTicket(id, workspaceId, {
      status: newStatus,
      actor_type: 'agent',
      actor_id: actorId,
      actor_name: actorName
    });
  }

  /**
   * Resolve ticket
   */
  async resolveTicket(id, workspaceId, actorId, actorName) {
    return this.changeStatus(id, workspaceId, 'resolved', actorId, actorName);
  }

  /**
   * Close ticket
   */
  async closeTicket(id, workspaceId, actorId, actorName) {
    return this.changeStatus(id, workspaceId, 'closed', actorId, actorName);
  }

  /**
   * Reopen ticket
   */
  async reopenTicket(id, workspaceId, actorId, actorName) {
    const ticket = await db('tickets')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .first();

    if (!ticket) return null;

    const [updated] = await db('tickets')
      .where('id', id)
      .update({
        status: 'open',
        resolved_at: null,
        closed_at: null,
        updated_at: new Date()
      })
      .returning('*');

    await this.logActivity(id, 'status_changed', ticket.status, 'open', {
      actorType: 'agent',
      actorId,
      actorName
    });

    return updated;
  }

  // ==================== Assignment ====================

  /**
   * Assign ticket to user
   */
  async assignTicket(id, workspaceId, assigneeId, assignedBy, assignedByName) {
    const ticket = await db('tickets')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .first();

    if (!ticket) return null;

    // Mark previous assignment as not current
    if (ticket.assignee_id) {
      await db('ticket_assignments')
        .where('ticket_id', id)
        .where('is_current', true)
        .update({
          is_current: false,
          unassigned_at: new Date()
        });
    }

    // Create new assignment record
    await db('ticket_assignments').insert({
      ticket_id: id,
      assignee_id: assigneeId,
      assigned_by: assignedBy,
      assigned_at: new Date(),
      is_current: true
    });

    // Update ticket
    const [updated] = await db('tickets')
      .where('id', id)
      .update({
        assignee_id: assigneeId,
        updated_at: new Date()
      })
      .returning('*');

    // Log activity
    const assignee = await db('users').where('id', assigneeId).first();
    await this.logActivity(id, 'assigned', ticket.assignee_id?.toString(), assigneeId.toString(), {
      actorType: 'agent',
      actorId: assignedBy,
      actorName: assignedByName,
      metadata: { assignee_name: assignee?.name }
    });

    // Record first response if this is the first assignment
    if (!ticket.first_response_at) {
      await db('tickets')
        .where('id', id)
        .update({ first_response_at: new Date() });
    }

    return updated;
  }

  /**
   * Unassign ticket
   */
  async unassignTicket(id, workspaceId, actorId, actorName) {
    const ticket = await db('tickets')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .first();

    if (!ticket) return null;

    // Mark current assignment as not current
    await db('ticket_assignments')
      .where('ticket_id', id)
      .where('is_current', true)
      .update({
        is_current: false,
        unassigned_at: new Date()
      });

    // Update ticket
    const [updated] = await db('tickets')
      .where('id', id)
      .update({
        assignee_id: null,
        updated_at: new Date()
      })
      .returning('*');

    await this.logActivity(id, 'unassigned', ticket.assignee_id?.toString(), null, {
      actorType: 'agent',
      actorId,
      actorName
    });

    return updated;
  }

  /**
   * Auto-assign ticket (round-robin or least-busy)
   */
  async autoAssign(id, workspaceId) {
    // Get workspace agents ordered by current ticket count (least-busy)
    const agents = await db('users as u')
      .select('u.id', 'u.name')
      .leftJoin('organization_members as om', 'om.user_id', 'u.id')
      .leftJoin('organizations as o', 'o.id', 'om.org_id')
      .leftJoin('workspaces as w', 'w.organization_id', 'o.id')
      .where('w.id', workspaceId)
      .where('om.status', 'active');

    if (agents.length === 0) return null;

    // Count open tickets per agent
    const agentTicketCounts = await db('tickets')
      .select('assignee_id')
      .count('id as ticket_count')
      .where('workspace_id', workspaceId)
      .whereIn('status', ['open', 'pending'])
      .whereNotNull('assignee_id')
      .groupBy('assignee_id');

    const countMap = {};
    agentTicketCounts.forEach(a => {
      countMap[a.assignee_id] = parseInt(a.ticket_count);
    });

    // Find agent with least tickets
    let minTickets = Infinity;
    let selectedAgent = agents[0];

    for (const agent of agents) {
      const count = countMap[agent.id] || 0;
      if (count < minTickets) {
        minTickets = count;
        selectedAgent = agent;
      }
    }

    return this.assignTicket(id, workspaceId, selectedAgent.id, null, 'System (Auto-assign)');
  }

  // ==================== Comments ====================

  /**
   * Get comments for ticket
   */
  async getComments(ticketId, includeInternal = true) {
    let query = db('ticket_comments')
      .where('ticket_id', ticketId)
      .orderBy('created_at', 'asc');

    if (!includeInternal) {
      query = query.where('is_internal', false);
    }

    return query;
  }

  /**
   * Add comment to ticket
   */
  async addComment(ticketId, data) {
    const [comment] = await db('ticket_comments')
      .insert({
        ticket_id: ticketId,
        author_type: data.author_type,
        author_id: data.author_id,
        author_name: data.author_name,
        author_email: data.author_email,
        body: data.body,
        body_html: data.body_html,
        is_internal: data.is_internal || false,
        attachments: data.attachments || []
      })
      .returning('*');

    // Log activity
    await this.logActivity(ticketId, 'commented', null, null, {
      actorType: data.author_type,
      actorId: data.author_id,
      actorName: data.author_name,
      metadata: { comment_id: comment.id, is_internal: comment.is_internal }
    });

    // Update ticket's first_response_at if agent comment and not set
    if (data.author_type === 'agent') {
      await db('tickets')
        .where('id', ticketId)
        .whereNull('first_response_at')
        .update({ first_response_at: new Date() });
    }

    // Update ticket's updated_at
    await db('tickets')
      .where('id', ticketId)
      .update({ updated_at: new Date() });

    return comment;
  }

  /**
   * Update comment
   */
  async updateComment(ticketId, commentId, data) {
    const [comment] = await db('ticket_comments')
      .where('id', commentId)
      .where('ticket_id', ticketId)
      .update({
        body: data.body,
        body_html: data.body_html
      })
      .returning('*');

    return comment;
  }

  /**
   * Delete comment
   */
  async deleteComment(ticketId, commentId) {
    const deleted = await db('ticket_comments')
      .where('id', commentId)
      .where('ticket_id', ticketId)
      .del();

    return deleted > 0;
  }

  // ==================== Activities ====================

  /**
   * Get activities for ticket
   */
  async getActivities(ticketId) {
    return db('ticket_activities')
      .where('ticket_id', ticketId)
      .orderBy('created_at', 'desc');
  }

  /**
   * Log activity
   */
  async logActivity(ticketId, activityType, oldValue, newValue, options = {}) {
    const [activity] = await db('ticket_activities')
      .insert({
        ticket_id: ticketId,
        actor_type: options.actorType || 'system',
        actor_id: options.actorId,
        actor_name: options.actorName,
        activity_type: activityType,
        old_value: oldValue?.toString(),
        new_value: newValue?.toString(),
        metadata: options.metadata || {}
      })
      .returning('*');

    return activity;
  }

  // ==================== Categories ====================

  /**
   * Get categories for workspace
   */
  async getCategories(workspaceId) {
    return db('ticket_categories')
      .where('workspace_id', workspaceId)
      .orderBy('sort_order', 'asc');
  }

  /**
   * Create category
   */
  async createCategory(workspaceId, data) {
    const [category] = await db('ticket_categories')
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        parent_id: data.parent_id,
        sort_order: data.sort_order || 0,
        is_active: data.is_active !== false
      })
      .returning('*');

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(id, workspaceId, data) {
    const [category] = await db('ticket_categories')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .update({
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        parent_id: data.parent_id,
        sort_order: data.sort_order,
        is_active: data.is_active
      })
      .returning('*');

    return category;
  }

  /**
   * Delete category
   */
  async deleteCategory(id, workspaceId) {
    const deleted = await db('ticket_categories')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .del();

    return deleted > 0;
  }

  // ==================== SLA Policies ====================

  /**
   * Get SLA policies for workspace
   */
  async getSLAPolicies(workspaceId) {
    return db('sla_policies')
      .where('workspace_id', workspaceId)
      .orderBy('created_at', 'desc');
  }

  /**
   * Create SLA policy
   */
  async createSLAPolicy(workspaceId, data) {
    // If this is default, unset other defaults
    if (data.is_default) {
      await db('sla_policies')
        .where('workspace_id', workspaceId)
        .update({ is_default: false });
    }

    const [policy] = await db('sla_policies')
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        description: data.description,
        first_response_time: data.first_response_time,
        resolution_time: data.resolution_time,
        business_hours_only: data.business_hours_only !== false,
        priority_overrides: data.priority_overrides || {},
        is_default: data.is_default || false,
        is_active: data.is_active !== false
      })
      .returning('*');

    return policy;
  }

  /**
   * Update SLA policy
   */
  async updateSLAPolicy(id, workspaceId, data) {
    // If this is default, unset other defaults
    if (data.is_default) {
      await db('sla_policies')
        .where('workspace_id', workspaceId)
        .whereNot('id', id)
        .update({ is_default: false });
    }

    const [policy] = await db('sla_policies')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .update({
        name: data.name,
        description: data.description,
        first_response_time: data.first_response_time,
        resolution_time: data.resolution_time,
        business_hours_only: data.business_hours_only,
        priority_overrides: data.priority_overrides,
        is_default: data.is_default,
        is_active: data.is_active
      })
      .returning('*');

    return policy;
  }

  /**
   * Delete SLA policy
   */
  async deleteSLAPolicy(id, workspaceId) {
    const deleted = await db('sla_policies')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .del();

    return deleted > 0;
  }

  /**
   * Check SLA breach for ticket
   */
  async checkSLABreach(ticketId) {
    const ticket = await db('tickets').where('id', ticketId).first();
    if (!ticket || !ticket.sla_policy_id) {
      return { firstResponseBreached: false, resolutionBreached: false };
    }

    const slaPolicy = await db('sla_policies').where('id', ticket.sla_policy_id).first();
    if (!slaPolicy) {
      return { firstResponseBreached: false, resolutionBreached: false };
    }

    const now = new Date();
    const createdAt = new Date(ticket.created_at);

    // Get SLA times based on priority
    const firstResponseTime = slaPolicy.priority_overrides?.[ticket.priority]?.first_response || slaPolicy.first_response_time;
    const resolutionTime = slaPolicy.priority_overrides?.[ticket.priority]?.resolution || slaPolicy.resolution_time;

    // Check first response breach
    let firstResponseBreached = false;
    if (firstResponseTime && !ticket.first_response_at) {
      const deadline = new Date(createdAt.getTime() + firstResponseTime * 60 * 1000);
      firstResponseBreached = now > deadline;
    }

    // Check resolution breach
    let resolutionBreached = false;
    if (resolutionTime && !ticket.resolved_at && ticket.status !== 'closed') {
      const deadline = new Date(createdAt.getTime() + resolutionTime * 60 * 1000);
      resolutionBreached = now > deadline;
    }

    return { firstResponseBreached, resolutionBreached };
  }

  /**
   * Get SLA status for ticket
   */
  async getSLAStatus(ticketId) {
    const ticket = await db('tickets').where('id', ticketId).first();
    if (!ticket || !ticket.sla_policy_id) {
      return null;
    }

    const slaPolicy = await db('sla_policies').where('id', ticket.sla_policy_id).first();
    if (!slaPolicy) {
      return null;
    }

    const now = new Date();
    const createdAt = new Date(ticket.created_at);

    const firstResponseTime = slaPolicy.priority_overrides?.[ticket.priority]?.first_response || slaPolicy.first_response_time;
    const resolutionTime = slaPolicy.priority_overrides?.[ticket.priority]?.resolution || slaPolicy.resolution_time;

    // First response SLA
    let firstResponse = null;
    if (firstResponseTime) {
      const target = new Date(createdAt.getTime() + firstResponseTime * 60 * 1000);
      const actual = ticket.first_response_at ? new Date(ticket.first_response_at) : null;
      const breached = actual ? actual > target : now > target;

      firstResponse = {
        target: firstResponseTime,
        targetTime: target,
        actual: actual ? Math.round((actual - createdAt) / 60000) : null,
        actualTime: actual,
        breached,
        remainingMinutes: actual ? null : Math.max(0, Math.round((target - now) / 60000))
      };
    }

    // Resolution SLA
    let resolution = null;
    if (resolutionTime) {
      const target = new Date(createdAt.getTime() + resolutionTime * 60 * 1000);
      const actual = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
      const breached = actual ? actual > target : (ticket.status !== 'closed' && now > target);

      resolution = {
        target: resolutionTime,
        targetTime: target,
        actual: actual ? Math.round((actual - createdAt) / 60000) : null,
        actualTime: actual,
        breached,
        remainingMinutes: actual ? null : Math.max(0, Math.round((target - now) / 60000))
      };
    }

    return { firstResponse, resolution };
  }

  // ==================== Canned Responses ====================

  /**
   * Get canned responses for workspace
   */
  async getCannedResponses(workspaceId, options = {}) {
    let query = db('canned_responses')
      .where('workspace_id', workspaceId);

    if (options.category) {
      query = query.where('category', options.category);
    }

    if (options.is_active !== undefined) {
      query = query.where('is_active', options.is_active);
    }

    if (options.search) {
      query = query.where(function() {
        this.whereILike('title', `%${options.search}%`)
          .orWhereILike('content', `%${options.search}%`)
          .orWhereILike('shortcut', `%${options.search}%`);
      });
    }

    return query.orderBy('usage_count', 'desc');
  }

  /**
   * Create canned response
   */
  async createCannedResponse(workspaceId, data) {
    const [response] = await db('canned_responses')
      .insert({
        workspace_id: workspaceId,
        title: data.title,
        content: data.content,
        content_html: data.content_html,
        shortcut: data.shortcut,
        category: data.category,
        is_active: data.is_active !== false,
        created_by: data.created_by
      })
      .returning('*');

    return response;
  }

  /**
   * Update canned response
   */
  async updateCannedResponse(id, workspaceId, data) {
    const [response] = await db('canned_responses')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .update({
        title: data.title,
        content: data.content,
        content_html: data.content_html,
        shortcut: data.shortcut,
        category: data.category,
        is_active: data.is_active,
        updated_at: new Date()
      })
      .returning('*');

    return response;
  }

  /**
   * Delete canned response
   */
  async deleteCannedResponse(id, workspaceId) {
    const deleted = await db('canned_responses')
      .where('id', id)
      .where('workspace_id', workspaceId)
      .del();

    return deleted > 0;
  }

  /**
   * Increment usage count for canned response
   */
  async incrementUsage(id) {
    await db('canned_responses')
      .where('id', id)
      .increment('usage_count', 1);
  }

  // ==================== Merge Tickets ====================

  /**
   * Merge multiple tickets into one
   */
  async mergeTickets(primaryId, secondaryIds, workspaceId, actorId, actorName) {
    const primaryTicket = await db('tickets')
      .where('id', primaryId)
      .where('workspace_id', workspaceId)
      .first();

    if (!primaryTicket) return null;

    // Get secondary tickets
    const secondaryTickets = await db('tickets')
      .whereIn('id', secondaryIds)
      .where('workspace_id', workspaceId);

    if (secondaryTickets.length === 0) return null;

    // Move comments from secondary to primary
    for (const secondary of secondaryTickets) {
      await db('ticket_comments')
        .where('ticket_id', secondary.id)
        .update({ ticket_id: primaryId });

      // Move activities
      await db('ticket_activities')
        .where('ticket_id', secondary.id)
        .update({ ticket_id: primaryId });

      // Log merge activity
      await this.logActivity(primaryId, 'merged', null, secondary.ticket_number, {
        actorType: 'agent',
        actorId,
        actorName,
        metadata: { merged_ticket_id: secondary.id, merged_ticket_number: secondary.ticket_number }
      });

      // Close secondary ticket
      await db('tickets')
        .where('id', secondary.id)
        .update({
          status: 'closed',
          closed_at: new Date(),
          metadata: db.raw(`metadata || ?::jsonb`, [JSON.stringify({ merged_into: primaryId })])
        });
    }

    return this.getTicketById(primaryId, workspaceId);
  }

  // ==================== Satisfaction ====================

  /**
   * Submit satisfaction rating
   */
  async submitRating(ticketId, rating, feedback) {
    // Check if already rated
    const existing = await db('ticket_satisfaction')
      .where('ticket_id', ticketId)
      .first();

    if (existing) {
      // Update existing
      const [satisfaction] = await db('ticket_satisfaction')
        .where('ticket_id', ticketId)
        .update({
          rating,
          feedback,
          submitted_at: new Date()
        })
        .returning('*');

      return satisfaction;
    }

    const [satisfaction] = await db('ticket_satisfaction')
      .insert({
        ticket_id: ticketId,
        rating,
        feedback
      })
      .returning('*');

    await this.logActivity(ticketId, 'rated', null, rating.toString(), {
      actorType: 'customer',
      metadata: { feedback }
    });

    return satisfaction;
  }

  /**
   * Get satisfaction stats for workspace
   */
  async getSatisfactionStats(workspaceId, dateRange = {}) {
    let query = db('ticket_satisfaction as ts')
      .join('tickets as t', 't.id', 'ts.ticket_id')
      .where('t.workspace_id', workspaceId);

    if (dateRange.startDate) {
      query = query.where('ts.submitted_at', '>=', dateRange.startDate);
    }
    if (dateRange.endDate) {
      query = query.where('ts.submitted_at', '<=', dateRange.endDate);
    }

    const stats = await query
      .select(
        db.raw('COUNT(*) as total_ratings'),
        db.raw('AVG(ts.rating) as average_rating'),
        db.raw('COUNT(CASE WHEN ts.rating >= 4 THEN 1 END) as positive_count'),
        db.raw('COUNT(CASE WHEN ts.rating <= 2 THEN 1 END) as negative_count')
      )
      .first();

    // Distribution
    const distribution = await query.clone()
      .select('ts.rating')
      .count('* as count')
      .groupBy('ts.rating')
      .orderBy('ts.rating');

    return {
      totalRatings: parseInt(stats.total_ratings) || 0,
      averageRating: parseFloat(stats.average_rating) || 0,
      positiveCount: parseInt(stats.positive_count) || 0,
      negativeCount: parseInt(stats.negative_count) || 0,
      satisfactionRate: stats.total_ratings > 0
        ? (stats.positive_count / stats.total_ratings * 100).toFixed(1)
        : 0,
      distribution: distribution.map(d => ({
        rating: d.rating,
        count: parseInt(d.count)
      }))
    };
  }

  // ==================== Analytics ====================

  /**
   * Get ticket statistics for workspace
   */
  async getTicketStats(workspaceId, dateRange = {}) {
    let query = db('tickets').where('workspace_id', workspaceId);

    if (dateRange.startDate) {
      query = query.where('created_at', '>=', dateRange.startDate);
    }
    if (dateRange.endDate) {
      query = query.where('created_at', '<=', dateRange.endDate);
    }

    const stats = await query
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count"),
        db.raw("COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count"),
        db.raw("COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count"),
        db.raw("COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_count"),
        db.raw('AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/60) as avg_first_response_minutes'),
        db.raw('AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_resolution_minutes')
      )
      .first();

    // By priority
    const byPriority = await query.clone()
      .select('priority')
      .count('* as count')
      .groupBy('priority');

    // By source
    const bySource = await query.clone()
      .select('source')
      .count('* as count')
      .groupBy('source');

    // Daily trend (last 30 days)
    const dailyTrend = await db('tickets')
      .where('workspace_id', workspaceId)
      .where('created_at', '>=', db.raw("NOW() - INTERVAL '30 days'"))
      .select(db.raw("DATE(created_at) as date"))
      .count('* as count')
      .groupBy(db.raw("DATE(created_at)"))
      .orderBy('date');

    return {
      total: parseInt(stats.total) || 0,
      open: parseInt(stats.open_count) || 0,
      pending: parseInt(stats.pending_count) || 0,
      resolved: parseInt(stats.resolved_count) || 0,
      closed: parseInt(stats.closed_count) || 0,
      avgFirstResponseMinutes: parseFloat(stats.avg_first_response_minutes) || 0,
      avgResolutionMinutes: parseFloat(stats.avg_resolution_minutes) || 0,
      byPriority: byPriority.map(p => ({ priority: p.priority, count: parseInt(p.count) })),
      bySource: bySource.map(s => ({ source: s.source, count: parseInt(s.count) })),
      dailyTrend: dailyTrend.map(d => ({ date: d.date, count: parseInt(d.count) }))
    };
  }

  /**
   * Get agent statistics
   */
  async getAgentStats(workspaceId, agentId, dateRange = {}) {
    let query = db('tickets')
      .where('workspace_id', workspaceId)
      .where('assignee_id', agentId);

    if (dateRange.startDate) {
      query = query.where('created_at', '>=', dateRange.startDate);
    }
    if (dateRange.endDate) {
      query = query.where('created_at', '<=', dateRange.endDate);
    }

    const stats = await query
      .select(
        db.raw('COUNT(*) as total_assigned'),
        db.raw("COUNT(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 END) as resolved_count"),
        db.raw('AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/60) as avg_first_response_minutes'),
        db.raw('AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_resolution_minutes')
      )
      .first();

    // Satisfaction for agent
    const satisfaction = await db('ticket_satisfaction as ts')
      .join('tickets as t', 't.id', 'ts.ticket_id')
      .where('t.workspace_id', workspaceId)
      .where('t.assignee_id', agentId)
      .select(
        db.raw('AVG(ts.rating) as avg_rating'),
        db.raw('COUNT(*) as rating_count')
      )
      .first();

    return {
      totalAssigned: parseInt(stats.total_assigned) || 0,
      resolvedCount: parseInt(stats.resolved_count) || 0,
      avgFirstResponseMinutes: parseFloat(stats.avg_first_response_minutes) || 0,
      avgResolutionMinutes: parseFloat(stats.avg_resolution_minutes) || 0,
      avgSatisfactionRating: parseFloat(satisfaction.avg_rating) || 0,
      satisfactionRatingCount: parseInt(satisfaction.rating_count) || 0
    };
  }

  /**
   * Get SLA performance statistics
   */
  async getSLAPerformance(workspaceId, dateRange = {}) {
    let query = db('tickets')
      .where('workspace_id', workspaceId)
      .whereNotNull('sla_policy_id');

    if (dateRange.startDate) {
      query = query.where('created_at', '>=', dateRange.startDate);
    }
    if (dateRange.endDate) {
      query = query.where('created_at', '<=', dateRange.endDate);
    }

    const tickets = await query;

    let totalWithSLA = 0;
    let firstResponseMet = 0;
    let firstResponseBreached = 0;
    let resolutionMet = 0;
    let resolutionBreached = 0;

    for (const ticket of tickets) {
      totalWithSLA++;
      const slaStatus = await this.getSLAStatus(ticket.id);

      if (slaStatus?.firstResponse) {
        if (slaStatus.firstResponse.breached) {
          firstResponseBreached++;
        } else if (slaStatus.firstResponse.actual !== null) {
          firstResponseMet++;
        }
      }

      if (slaStatus?.resolution) {
        if (slaStatus.resolution.breached) {
          resolutionBreached++;
        } else if (slaStatus.resolution.actual !== null) {
          resolutionMet++;
        }
      }
    }

    return {
      totalWithSLA,
      firstResponse: {
        met: firstResponseMet,
        breached: firstResponseBreached,
        rate: totalWithSLA > 0 ? ((firstResponseMet / totalWithSLA) * 100).toFixed(1) : 0
      },
      resolution: {
        met: resolutionMet,
        breached: resolutionBreached,
        rate: totalWithSLA > 0 ? ((resolutionMet / totalWithSLA) * 100).toFixed(1) : 0
      }
    };
  }
}

module.exports = new TicketService();

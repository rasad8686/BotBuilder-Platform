/**
 * Ticket Assignment Service
 * Handles automatic ticket assignment with various strategies
 */

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Assignment strategies
const STRATEGIES = {
  ROUND_ROBIN: 'round_robin',
  LEAST_BUSY: 'least_busy',
  LOAD_BALANCED: 'load_balanced',
  SKILL_BASED: 'skill_based',
  MANUAL: 'manual',
};

class TicketAssignmentService {
  /**
   * Auto-assign a ticket based on workspace settings
   */
  async autoAssign(ticket) {
    try {
      const settings = await this.getAssignmentSettings(ticket.workspace_id);

      if (!settings || !settings.auto_assign_enabled) {
        return null;
      }

      // Check if already assigned
      if (ticket.assignee_id) {
        return null;
      }

      const strategy = settings.assignment_strategy || STRATEGIES.ROUND_ROBIN;
      let assignee = null;

      switch (strategy) {
        case STRATEGIES.ROUND_ROBIN:
          assignee = await this.roundRobinAssign(ticket.workspace_id, ticket.team_id);
          break;
        case STRATEGIES.LEAST_BUSY:
          assignee = await this.leastBusyAssign(ticket.workspace_id, ticket.team_id);
          break;
        case STRATEGIES.LOAD_BALANCED:
          assignee = await this.loadBalancedAssign(ticket.workspace_id, ticket.team_id);
          break;
        case STRATEGIES.SKILL_BASED:
          assignee = await this.skillBasedAssign(
            ticket.workspace_id,
            ticket.category_id,
            ticket.priority
          );
          break;
        case STRATEGIES.MANUAL:
        default:
          return null;
      }

      if (assignee) {
        await this.assignTicket(ticket.id, assignee.id);
        return assignee;
      }

      return null;
    } catch (error) {
      console.error('Error in auto-assign:', error);
      return null;
    }
  }

  /**
   * Get assignment settings for a workspace
   */
  async getAssignmentSettings(workspaceId) {
    return db('agent_assignment_settings')
      .where('workspace_id', workspaceId)
      .first();
  }

  /**
   * Create or update assignment settings
   */
  async saveAssignmentSettings(workspaceId, settings) {
    const existing = await this.getAssignmentSettings(workspaceId);

    if (existing) {
      await db('agent_assignment_settings')
        .where('workspace_id', workspaceId)
        .update({
          ...settings,
          updated_at: new Date(),
        });
    } else {
      await db('agent_assignment_settings').insert({
        id: uuidv4(),
        workspace_id: workspaceId,
        ...settings,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    return this.getAssignmentSettings(workspaceId);
  }

  /**
   * Round Robin assignment - assign to next agent in rotation
   */
  async roundRobinAssign(workspaceId, teamId = null) {
    const availableAgents = await this.getAvailableAgents(workspaceId, teamId);

    if (availableAgents.length === 0) {
      return null;
    }

    // Get or create queue position
    const queueKey = teamId ? `${workspaceId}_${teamId}` : `${workspaceId}_all`;
    let queue = await db('assignment_queue')
      .where({ workspace_id: workspaceId, team_id: teamId })
      .first();

    if (!queue) {
      queue = {
        id: uuidv4(),
        workspace_id: workspaceId,
        team_id: teamId,
        position: 0,
        last_assigned_agent_id: null,
      };
      await db('assignment_queue').insert(queue);
    }

    // Find next agent
    let nextPosition = (queue.position + 1) % availableAgents.length;
    const nextAgent = availableAgents[nextPosition];

    // Update queue position
    await db('assignment_queue')
      .where('id', queue.id)
      .update({
        position: nextPosition,
        last_assigned_agent_id: nextAgent.agent_id,
        updated_at: new Date(),
      });

    // Update agent's last assigned time
    await this.updateAgentLastAssigned(nextAgent.agent_id, workspaceId);

    return { id: nextAgent.agent_id, ...nextAgent };
  }

  /**
   * Least Busy assignment - assign to agent with fewest open tickets
   */
  async leastBusyAssign(workspaceId, teamId = null) {
    const availableAgents = await this.getAvailableAgents(workspaceId, teamId);

    if (availableAgents.length === 0) {
      return null;
    }

    // Get ticket counts for each agent
    const agentLoads = await Promise.all(
      availableAgents.map(async (agent) => {
        const count = await db('tickets')
          .where('assignee_id', agent.agent_id)
          .where('workspace_id', workspaceId)
          .whereNotIn('status', ['closed', 'resolved'])
          .count('id as count')
          .first();

        return {
          ...agent,
          ticket_count: parseInt(count?.count || 0),
        };
      })
    );

    // Sort by ticket count (ascending) and pick the least busy
    agentLoads.sort((a, b) => a.ticket_count - b.ticket_count);
    const leastBusy = agentLoads[0];

    if (leastBusy) {
      await this.updateAgentLastAssigned(leastBusy.agent_id, workspaceId);
    }

    return leastBusy ? { id: leastBusy.agent_id, ...leastBusy } : null;
  }

  /**
   * Load Balanced assignment - consider agent capacity
   */
  async loadBalancedAssign(workspaceId, teamId = null) {
    const availableAgents = await this.getAvailableAgents(workspaceId, teamId);

    if (availableAgents.length === 0) {
      return null;
    }

    // Calculate load percentage for each agent
    const agentLoads = await Promise.all(
      availableAgents.map(async (agent) => {
        const capacity = await this.checkAgentCapacity(agent.agent_id, workspaceId);
        return {
          ...agent,
          ...capacity,
          load_percentage: capacity.max > 0 ? (capacity.current / capacity.max) * 100 : 100,
        };
      })
    );

    // Filter out agents at max capacity
    const withCapacity = agentLoads.filter(a => a.available > 0);

    if (withCapacity.length === 0) {
      return null;
    }

    // Sort by load percentage (ascending) and pick the one with most available capacity
    withCapacity.sort((a, b) => a.load_percentage - b.load_percentage);
    const selected = withCapacity[0];

    if (selected) {
      await this.updateAgentLastAssigned(selected.agent_id, workspaceId);
    }

    return selected ? { id: selected.agent_id, ...selected } : null;
  }

  /**
   * Skill Based assignment - match ticket category to agent skills
   */
  async skillBasedAssign(workspaceId, categoryId, priority) {
    const availableAgents = await this.getAvailableAgents(workspaceId);

    if (availableAgents.length === 0) {
      return null;
    }

    // Get category skills requirements
    const category = categoryId
      ? await db('ticket_categories').where('id', categoryId).first()
      : null;

    const requiredSkills = category?.required_skills || [];

    // Score each agent based on skill match
    const scoredAgents = availableAgents.map(agent => {
      const skills = agent.skills || [];
      let score = 0;

      // Base score for availability
      score += 10;

      // Score for matching skills
      for (const required of requiredSkills) {
        const agentSkill = skills.find(s => s.skill_id === required.skill_id);
        if (agentSkill) {
          score += agentSkill.level * 5; // Higher level = higher score
        }
      }

      // Bonus for priority handling
      if (priority === 'urgent' || priority === 'critical') {
        const seniorSkill = skills.find(s => s.skill_id === 'senior_support');
        if (seniorSkill) {
          score += 20;
        }
      }

      return { ...agent, score };
    });

    // Sort by score (descending) and pick the best match
    scoredAgents.sort((a, b) => b.score - a.score);
    const bestMatch = scoredAgents[0];

    if (bestMatch) {
      await this.updateAgentLastAssigned(bestMatch.agent_id, workspaceId);
    }

    return bestMatch ? { id: bestMatch.agent_id, ...bestMatch } : null;
  }

  /**
   * Get available agents for assignment
   */
  async getAvailableAgents(workspaceId, teamId = null) {
    let query = db('agent_availability')
      .where('workspace_id', workspaceId)
      .where('status', 'available');

    if (teamId) {
      query = query.whereExists(function() {
        this.select('*')
          .from('team_members')
          .whereRaw('team_members.user_id = agent_availability.agent_id')
          .where('team_members.team_id', teamId);
      });
    }

    const agents = await query;

    // Parse skills JSON
    return agents.map(agent => ({
      ...agent,
      skills: typeof agent.skills === 'string' ? JSON.parse(agent.skills) : (agent.skills || []),
    }));
  }

  /**
   * Check agent's current capacity
   */
  async checkAgentCapacity(agentId, workspaceId) {
    const availability = await db('agent_availability')
      .where({ agent_id: agentId, workspace_id: workspaceId })
      .first();

    const maxCapacity = availability?.max_capacity || 20;

    const openTickets = await db('tickets')
      .where('assignee_id', agentId)
      .where('workspace_id', workspaceId)
      .whereNotIn('status', ['closed', 'resolved'])
      .count('id as count')
      .first();

    const current = parseInt(openTickets?.count || 0);

    return {
      current,
      max: maxCapacity,
      available: Math.max(0, maxCapacity - current),
    };
  }

  /**
   * Assign ticket to a specific agent
   */
  async assignTicket(ticketId, agentId) {
    await db('tickets')
      .where('id', ticketId)
      .update({
        assignee_id: agentId,
        assigned_at: new Date(),
        status: db.raw("CASE WHEN status = 'new' THEN 'open' ELSE status END"),
        updated_at: new Date(),
      });

    // Update agent's current load
    const ticket = await db('tickets').where('id', ticketId).first();
    if (ticket) {
      await db('agent_availability')
        .where({ agent_id: agentId, workspace_id: ticket.workspace_id })
        .update({
          current_load: db.raw('current_load + 1'),
        });
    }

    return { ticketId, agentId, assignedAt: new Date() };
  }

  /**
   * Assign ticket to a team member
   */
  async assignToTeam(ticketId, teamId) {
    const ticket = await db('tickets').where('id', ticketId).first();
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const settings = await this.getAssignmentSettings(ticket.workspace_id);
    const strategy = settings?.assignment_strategy || STRATEGIES.ROUND_ROBIN;

    let assignee = null;

    switch (strategy) {
      case STRATEGIES.ROUND_ROBIN:
        assignee = await this.roundRobinAssign(ticket.workspace_id, teamId);
        break;
      case STRATEGIES.LEAST_BUSY:
        assignee = await this.leastBusyAssign(ticket.workspace_id, teamId);
        break;
      case STRATEGIES.LOAD_BALANCED:
        assignee = await this.loadBalancedAssign(ticket.workspace_id, teamId);
        break;
      default:
        assignee = await this.roundRobinAssign(ticket.workspace_id, teamId);
    }

    if (assignee) {
      await this.assignTicket(ticketId, assignee.id);
    }

    return assignee;
  }

  /**
   * Unassign ticket
   */
  async unassignTicket(ticketId) {
    const ticket = await db('tickets').where('id', ticketId).first();

    if (ticket && ticket.assignee_id) {
      // Decrease agent's current load
      await db('agent_availability')
        .where({ agent_id: ticket.assignee_id, workspace_id: ticket.workspace_id })
        .update({
          current_load: db.raw('GREATEST(0, current_load - 1)'),
        });
    }

    await db('tickets')
      .where('id', ticketId)
      .update({
        assignee_id: null,
        assigned_at: null,
        updated_at: new Date(),
      });

    return { ticketId, unassignedAt: new Date() };
  }

  /**
   * Reassign ticket to another agent
   */
  async reassignTicket(ticketId, newAgentId) {
    await this.unassignTicket(ticketId);
    return this.assignTicket(ticketId, newAgentId);
  }

  /**
   * Update agent availability status
   */
  async updateAgentStatus(agentId, workspaceId, status) {
    await db('agent_availability')
      .where({ agent_id: agentId, workspace_id: workspaceId })
      .update({
        status,
        status_changed_at: new Date(),
        updated_at: new Date(),
      });

    return { agentId, status, changedAt: new Date() };
  }

  /**
   * Update agent's last assigned timestamp
   */
  async updateAgentLastAssigned(agentId, workspaceId) {
    await db('agent_availability')
      .where({ agent_id: agentId, workspace_id: workspaceId })
      .update({
        last_assigned_at: new Date(),
      });
  }

  /**
   * Get agent availability
   */
  async getAgentAvailability(agentId, workspaceId) {
    let availability = await db('agent_availability')
      .where({ agent_id: agentId, workspace_id: workspaceId })
      .first();

    if (!availability) {
      // Create default availability
      availability = {
        id: uuidv4(),
        agent_id: agentId,
        workspace_id: workspaceId,
        status: 'available',
        max_capacity: 20,
        current_load: 0,
        skills: '[]',
        created_at: new Date(),
        updated_at: new Date(),
      };
      await db('agent_availability').insert(availability);
    }

    const capacity = await this.checkAgentCapacity(agentId, workspaceId);

    return {
      ...availability,
      skills: typeof availability.skills === 'string'
        ? JSON.parse(availability.skills)
        : (availability.skills || []),
      ...capacity,
    };
  }

  /**
   * Update agent availability settings
   */
  async updateAgentAvailability(agentId, workspaceId, settings) {
    const existing = await db('agent_availability')
      .where({ agent_id: agentId, workspace_id: workspaceId })
      .first();

    if (existing) {
      const updates = { updated_at: new Date() };
      if (settings.max_capacity !== undefined) updates.max_capacity = settings.max_capacity;
      if (settings.skills !== undefined) updates.skills = JSON.stringify(settings.skills);
      if (settings.status !== undefined) {
        updates.status = settings.status;
        updates.status_changed_at = new Date();
      }
      if (settings.business_hours_id !== undefined) {
        updates.business_hours_id = settings.business_hours_id;
      }

      await db('agent_availability')
        .where('id', existing.id)
        .update(updates);
    } else {
      await db('agent_availability').insert({
        id: uuidv4(),
        agent_id: agentId,
        workspace_id: workspaceId,
        status: settings.status || 'available',
        max_capacity: settings.max_capacity || 20,
        current_load: 0,
        skills: JSON.stringify(settings.skills || []),
        business_hours_id: settings.business_hours_id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    return this.getAgentAvailability(agentId, workspaceId);
  }

  /**
   * Get assignment statistics
   */
  async getAssignmentStats(workspaceId) {
    const agents = await this.getAvailableAgents(workspaceId);

    const stats = await Promise.all(
      agents.map(async (agent) => {
        const capacity = await this.checkAgentCapacity(agent.agent_id, workspaceId);
        const todayAssigned = await db('tickets')
          .where('assignee_id', agent.agent_id)
          .where('workspace_id', workspaceId)
          .whereRaw("assigned_at >= CURRENT_DATE")
          .count('id as count')
          .first();

        return {
          agent_id: agent.agent_id,
          status: agent.status,
          ...capacity,
          today_assigned: parseInt(todayAssigned?.count || 0),
          last_assigned_at: agent.last_assigned_at,
        };
      })
    );

    return {
      total_agents: agents.length,
      available_agents: agents.filter(a => a.status === 'available').length,
      agent_stats: stats,
    };
  }
}

module.exports = new TicketAssignmentService();

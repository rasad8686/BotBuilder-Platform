/**
 * Ticket SLA Service
 * Handles SLA calculations, due dates, and breach detection
 */

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class TicketSLAService {
  /**
   * Calculate and set due dates for a ticket
   */
  async calculateAndSetDueDate(ticketId) {
    const ticket = await db('tickets').where('id', ticketId).first();
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const slaPolicy = await this.getSLAPolicy(ticket);
    if (!slaPolicy) {
      return null;
    }

    const businessHours = slaPolicy.business_hours_only
      ? await this.getBusinessHours(ticket.workspace_id)
      : null;

    const dueDates = this.calculateDueDate(ticket, slaPolicy, businessHours);

    await db('tickets')
      .where('id', ticketId)
      .update({
        sla_policy_id: slaPolicy.id,
        first_response_due: dueDates.firstResponseDue,
        resolution_due: dueDates.resolutionDue,
        updated_at: new Date(),
      });

    return dueDates;
  }

  /**
   * Get SLA policy for a ticket
   */
  async getSLAPolicy(ticket) {
    // Check if ticket has a specific SLA policy
    if (ticket.sla_policy_id) {
      return db('sla_policies').where('id', ticket.sla_policy_id).first();
    }

    // Find matching SLA policy based on conditions
    const policies = await db('sla_policies')
      .where('workspace_id', ticket.workspace_id)
      .where('is_active', true)
      .orderBy('priority', 'asc');

    for (const policy of policies) {
      if (await this.policyMatchesTicket(policy, ticket)) {
        return policy;
      }
    }

    // Return default policy if exists
    return db('sla_policies')
      .where('workspace_id', ticket.workspace_id)
      .where('is_default', true)
      .where('is_active', true)
      .first();
  }

  /**
   * Check if a policy matches a ticket
   */
  async policyMatchesTicket(policy, ticket) {
    const conditions = typeof policy.conditions === 'string'
      ? JSON.parse(policy.conditions)
      : (policy.conditions || []);

    if (conditions.length === 0) {
      return policy.is_default;
    }

    for (const condition of conditions) {
      const ticketValue = ticket[condition.field];
      const conditionValue = condition.value;

      switch (condition.operator) {
        case 'equals':
          if (ticketValue !== conditionValue) return false;
          break;
        case 'in':
          if (!conditionValue.includes(ticketValue)) return false;
          break;
        case 'not_in':
          if (conditionValue.includes(ticketValue)) return false;
          break;
        default:
          break;
      }
    }

    return true;
  }

  /**
   * Calculate due dates based on SLA policy
   */
  calculateDueDate(ticket, slaPolicy, businessHours = null) {
    const createdAt = new Date(ticket.created_at);
    const targets = typeof slaPolicy.targets === 'string'
      ? JSON.parse(slaPolicy.targets)
      : (slaPolicy.targets || {});

    // Get priority-specific targets or defaults
    const priority = ticket.priority || 'medium';
    const priorityTargets = targets[priority] || targets.default || {
      first_response: 60, // minutes
      resolution: 480, // minutes
    };

    let firstResponseDue, resolutionDue;

    if (businessHours && slaPolicy.business_hours_only) {
      firstResponseDue = this.addBusinessMinutes(
        createdAt,
        priorityTargets.first_response,
        businessHours
      );
      resolutionDue = this.addBusinessMinutes(
        createdAt,
        priorityTargets.resolution,
        businessHours
      );
    } else {
      firstResponseDue = new Date(createdAt.getTime() + priorityTargets.first_response * 60 * 1000);
      resolutionDue = new Date(createdAt.getTime() + priorityTargets.resolution * 60 * 1000);
    }

    return { firstResponseDue, resolutionDue };
  }

  /**
   * Get business hours for a workspace
   */
  async getBusinessHours(workspaceId) {
    const hours = await db('business_hours')
      .where('workspace_id', workspaceId)
      .where('is_default', true)
      .first();

    if (!hours) {
      return null;
    }

    return {
      ...hours,
      schedule: typeof hours.schedule === 'string' ? JSON.parse(hours.schedule) : hours.schedule,
      holidays: typeof hours.holidays === 'string' ? JSON.parse(hours.holidays) : hours.holidays,
    };
  }

  /**
   * Check if a datetime is within business hours
   */
  isWithinBusinessHours(datetime, businessHours) {
    if (!businessHours || !businessHours.schedule) {
      return true; // No business hours = always available
    }

    const date = new Date(datetime);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    const daySchedule = businessHours.schedule[dayName];

    if (!daySchedule || !daySchedule.start || !daySchedule.end) {
      return false; // Day not configured = not a business day
    }

    // Check holidays
    const dateStr = date.toISOString().split('T')[0];
    const holidays = businessHours.holidays || [];
    if (holidays.some(h => h.date === dateStr)) {
      return false;
    }

    // Check time
    const time = date.toTimeString().slice(0, 5); // HH:MM
    return time >= daySchedule.start && time < daySchedule.end;
  }

  /**
   * Add business minutes to a start date
   */
  addBusinessMinutes(startDate, minutes, businessHours) {
    if (!businessHours || !businessHours.schedule) {
      // No business hours = add regular minutes
      return new Date(startDate.getTime() + minutes * 60 * 1000);
    }

    let current = new Date(startDate);
    let remainingMinutes = minutes;
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Safety limit to prevent infinite loops
    let iterations = 0;
    const maxIterations = 365 * 24; // One year of hours

    while (remainingMinutes > 0 && iterations < maxIterations) {
      iterations++;

      const dayName = dayNames[current.getDay()];
      const daySchedule = businessHours.schedule[dayName];
      const dateStr = current.toISOString().split('T')[0];
      const holidays = businessHours.holidays || [];
      const isHoliday = holidays.some(h => h.date === dateStr);

      if (!daySchedule || !daySchedule.start || !daySchedule.end || isHoliday) {
        // Not a business day, move to next day start
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        continue;
      }

      const currentTime = current.toTimeString().slice(0, 5);

      if (currentTime < daySchedule.start) {
        // Before business hours, move to start
        const [hours, mins] = daySchedule.start.split(':').map(Number);
        current.setHours(hours, mins, 0, 0);
        continue;
      }

      if (currentTime >= daySchedule.end) {
        // After business hours, move to next day
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        continue;
      }

      // Within business hours, calculate remaining time in today
      const [endHours, endMins] = daySchedule.end.split(':').map(Number);
      const endOfDay = new Date(current);
      endOfDay.setHours(endHours, endMins, 0, 0);

      const minutesTillEnd = Math.floor((endOfDay - current) / (60 * 1000));

      if (remainingMinutes <= minutesTillEnd) {
        // Can complete within today
        current = new Date(current.getTime() + remainingMinutes * 60 * 1000);
        remainingMinutes = 0;
      } else {
        // Use up today and continue tomorrow
        remainingMinutes -= minutesTillEnd;
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
      }
    }

    return current;
  }

  /**
   * Check SLA status for a ticket
   */
  async checkSLAStatus(ticket) {
    const policy = await this.getSLAPolicy(ticket);
    if (!policy) {
      return null;
    }

    const now = new Date();
    const createdAt = new Date(ticket.created_at);

    // First response status
    const firstResponseTarget = ticket.first_response_due
      ? new Date(ticket.first_response_due)
      : null;
    const firstResponseActual = ticket.first_response_at
      ? new Date(ticket.first_response_at)
      : null;

    let firstResponseStatus;
    if (firstResponseActual) {
      firstResponseStatus = {
        target: firstResponseTarget,
        actual: firstResponseActual,
        met: firstResponseTarget ? firstResponseActual <= firstResponseTarget : true,
        breached: firstResponseTarget ? firstResponseActual > firstResponseTarget : false,
        remaining: null,
      };
    } else if (firstResponseTarget) {
      const remaining = Math.floor((firstResponseTarget - now) / (60 * 1000));
      firstResponseStatus = {
        target: firstResponseTarget,
        actual: null,
        met: false,
        breached: now > firstResponseTarget,
        remaining: remaining > 0 ? remaining : 0,
        percentage: Math.min(100, ((now - createdAt) / (firstResponseTarget - createdAt)) * 100),
      };
    } else {
      firstResponseStatus = null;
    }

    // Resolution status
    const resolutionTarget = ticket.resolution_due
      ? new Date(ticket.resolution_due)
      : null;
    const resolutionActual = ticket.resolved_at
      ? new Date(ticket.resolved_at)
      : null;

    let resolutionStatus;
    if (resolutionActual) {
      resolutionStatus = {
        target: resolutionTarget,
        actual: resolutionActual,
        met: resolutionTarget ? resolutionActual <= resolutionTarget : true,
        breached: resolutionTarget ? resolutionActual > resolutionTarget : false,
        remaining: null,
      };
    } else if (resolutionTarget) {
      const remaining = Math.floor((resolutionTarget - now) / (60 * 1000));
      resolutionStatus = {
        target: resolutionTarget,
        actual: null,
        met: false,
        breached: now > resolutionTarget,
        remaining: remaining > 0 ? remaining : 0,
        percentage: Math.min(100, ((now - createdAt) / (resolutionTarget - createdAt)) * 100),
      };
    } else {
      resolutionStatus = null;
    }

    return {
      policy: {
        id: policy.id,
        name: policy.name,
      },
      firstResponse: firstResponseStatus,
      resolution: resolutionStatus,
      overallStatus: this.getOverallSLAStatus(firstResponseStatus, resolutionStatus),
    };
  }

  /**
   * Get overall SLA status
   */
  getOverallSLAStatus(firstResponse, resolution) {
    if (!firstResponse && !resolution) {
      return 'no_sla';
    }

    if (firstResponse?.breached || resolution?.breached) {
      return 'breached';
    }

    if (firstResponse?.met === false || resolution?.met === false) {
      // Check if approaching breach (within 20% of time)
      const frPercentage = firstResponse?.percentage || 0;
      const resPercentage = resolution?.percentage || 0;

      if (frPercentage >= 80 || resPercentage >= 80) {
        return 'warning';
      }
      return 'on_track';
    }

    if (firstResponse?.met && (resolution?.met || !resolution?.actual)) {
      return 'met';
    }

    return 'on_track';
  }

  /**
   * Find tickets approaching SLA breach
   */
  async findApproachingBreach(workspaceId, thresholdMinutes = 30) {
    const now = new Date();
    const threshold = new Date(now.getTime() + thresholdMinutes * 60 * 1000);

    const tickets = await db('tickets')
      .where('workspace_id', workspaceId)
      .whereNotIn('status', ['closed', 'resolved'])
      .where(function() {
        this.where(function() {
          this.whereNull('first_response_at')
            .where('first_response_due', '<=', threshold)
            .where('first_response_due', '>', now);
        }).orWhere(function() {
          this.where('resolution_due', '<=', threshold)
            .where('resolution_due', '>', now);
        });
      });

    return tickets;
  }

  /**
   * Find breached tickets
   */
  async findBreachedTickets(workspaceId) {
    const now = new Date();

    const tickets = await db('tickets')
      .where('workspace_id', workspaceId)
      .whereNotIn('status', ['closed', 'resolved'])
      .where(function() {
        this.where(function() {
          this.whereNull('first_response_at')
            .where('first_response_due', '<', now);
        }).orWhere(function() {
          this.where('resolution_due', '<', now);
        });
      });

    return tickets;
  }

  /**
   * Record first response
   */
  async recordFirstResponse(ticketId) {
    const ticket = await db('tickets').where('id', ticketId).first();
    if (!ticket || ticket.first_response_at) {
      return null;
    }

    await db('tickets')
      .where('id', ticketId)
      .update({
        first_response_at: new Date(),
        updated_at: new Date(),
      });

    return this.checkSLAStatus({ ...ticket, first_response_at: new Date() });
  }

  /**
   * Record resolution
   */
  async recordResolution(ticketId) {
    const ticket = await db('tickets').where('id', ticketId).first();
    if (!ticket) {
      return null;
    }

    await db('tickets')
      .where('id', ticketId)
      .update({
        resolved_at: new Date(),
        updated_at: new Date(),
      });

    return this.checkSLAStatus({ ...ticket, resolved_at: new Date() });
  }

  /**
   * Get SLA statistics for a workspace
   */
  async getSLAStats(workspaceId, options = {}) {
    const { startDate, endDate } = options;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Total tickets with SLA
    const totalWithSLA = await db('tickets')
      .where('workspace_id', workspaceId)
      .whereNotNull('sla_policy_id')
      .whereBetween('created_at', [start, end])
      .count('id as count')
      .first();

    // First response metrics
    const firstResponseMet = await db('tickets')
      .where('workspace_id', workspaceId)
      .whereNotNull('first_response_at')
      .whereNotNull('first_response_due')
      .whereBetween('created_at', [start, end])
      .whereRaw('first_response_at <= first_response_due')
      .count('id as count')
      .first();

    const firstResponseBreached = await db('tickets')
      .where('workspace_id', workspaceId)
      .whereNotNull('first_response_at')
      .whereNotNull('first_response_due')
      .whereBetween('created_at', [start, end])
      .whereRaw('first_response_at > first_response_due')
      .count('id as count')
      .first();

    // Resolution metrics
    const resolutionMet = await db('tickets')
      .where('workspace_id', workspaceId)
      .whereNotNull('resolved_at')
      .whereNotNull('resolution_due')
      .whereBetween('created_at', [start, end])
      .whereRaw('resolved_at <= resolution_due')
      .count('id as count')
      .first();

    const resolutionBreached = await db('tickets')
      .where('workspace_id', workspaceId)
      .whereNotNull('resolved_at')
      .whereNotNull('resolution_due')
      .whereBetween('created_at', [start, end])
      .whereRaw('resolved_at > resolution_due')
      .count('id as count')
      .first();

    // Average response times
    const avgTimes = await db('tickets')
      .where('workspace_id', workspaceId)
      .whereNotNull('first_response_at')
      .whereBetween('created_at', [start, end])
      .select(
        db.raw('AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60) as avg_first_response'),
        db.raw('AVG(CASE WHEN resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60 END) as avg_resolution')
      )
      .first();

    const total = parseInt(totalWithSLA?.count || 0);
    const frMet = parseInt(firstResponseMet?.count || 0);
    const frBreached = parseInt(firstResponseBreached?.count || 0);
    const resMet = parseInt(resolutionMet?.count || 0);
    const resBreached = parseInt(resolutionBreached?.count || 0);

    return {
      period: { start, end },
      total_tickets: total,
      first_response: {
        met: frMet,
        breached: frBreached,
        compliance_rate: total > 0 ? ((frMet / (frMet + frBreached)) * 100) || 0 : 0,
        avg_time_minutes: parseFloat(avgTimes?.avg_first_response || 0).toFixed(1),
      },
      resolution: {
        met: resMet,
        breached: resBreached,
        compliance_rate: total > 0 ? ((resMet / (resMet + resBreached)) * 100) || 0 : 0,
        avg_time_minutes: parseFloat(avgTimes?.avg_resolution || 0).toFixed(1),
      },
      overall_compliance_rate: total > 0
        ? (((frMet + resMet) / ((frMet + frBreached + resMet + resBreached) || 1)) * 100).toFixed(1)
        : 0,
    };
  }

  /**
   * Create or update business hours
   */
  async saveBusinessHours(workspaceId, data) {
    if (data.id) {
      await db('business_hours')
        .where('id', data.id)
        .update({
          name: data.name,
          timezone: data.timezone,
          schedule: JSON.stringify(data.schedule),
          holidays: JSON.stringify(data.holidays || []),
          is_default: data.is_default,
          updated_at: new Date(),
        });

      return db('business_hours').where('id', data.id).first();
    }

    const id = uuidv4();
    await db('business_hours').insert({
      id,
      workspace_id: workspaceId,
      name: data.name,
      timezone: data.timezone || 'UTC',
      schedule: JSON.stringify(data.schedule),
      holidays: JSON.stringify(data.holidays || []),
      is_default: data.is_default || false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // If marked as default, unset other defaults
    if (data.is_default) {
      await db('business_hours')
        .where('workspace_id', workspaceId)
        .whereNot('id', id)
        .update({ is_default: false });
    }

    return db('business_hours').where('id', id).first();
  }

  /**
   * Get all business hours for a workspace
   */
  async getAllBusinessHours(workspaceId) {
    const hours = await db('business_hours')
      .where('workspace_id', workspaceId)
      .orderBy('is_default', 'desc');

    return hours.map(h => ({
      ...h,
      schedule: typeof h.schedule === 'string' ? JSON.parse(h.schedule) : h.schedule,
      holidays: typeof h.holidays === 'string' ? JSON.parse(h.holidays) : h.holidays,
    }));
  }

  /**
   * Delete business hours
   */
  async deleteBusinessHours(id) {
    const deleted = await db('business_hours').where('id', id).delete();
    return deleted > 0;
  }
}

module.exports = new TicketSLAService();

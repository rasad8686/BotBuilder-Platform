/**
 * IVR Service
 * Handles IVR flow CRUD operations and validation
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

class IVRService {
  /**
   * Create a new IVR flow
   */
  async createFlow(organizationId, data, userId) {
    const flowId = uuidv4();

    const flow = {
      id: flowId,
      organization_id: organizationId,
      name: data.name,
      description: data.description || null,
      phone_number: data.phone_number || null,
      is_active: false,
      flow_data: JSON.stringify(data.flow_data || {}),
      settings: JSON.stringify(data.settings || {}),
      welcome_message: data.welcome_message || 'Welcome to our service.',
      goodbye_message: data.goodbye_message || 'Thank you for calling. Goodbye.',
      error_message: data.error_message || 'Sorry, I didn\'t understand that.',
      default_language: data.default_language || 'en',
      max_retries: data.max_retries || 3,
      input_timeout: data.input_timeout || 5000,
      speech_timeout: data.speech_timeout || 3000,
      voice: data.voice || 'Polly.Joanna',
      status: 'draft',
      version: 1,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('ivr_flows').insert(flow);

    // Create initial nodes if provided
    if (data.nodes && Array.isArray(data.nodes)) {
      await this.saveNodes(flowId, data.nodes);
    }

    return this.getFlowById(flowId);
  }

  /**
   * Update an IVR flow
   */
  async updateFlow(flowId, data, userId) {
    const existingFlow = await db('ivr_flows').where({ id: flowId }).first();
    if (!existingFlow) {
      throw new Error('Flow not found');
    }

    // Save version history before update
    await this.saveFlowVersion(existingFlow, userId);

    const updates = {
      updated_by: userId,
      updated_at: new Date(),
      version: existingFlow.version + 1
    };

    // Update allowed fields
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.phone_number !== undefined) updates.phone_number = data.phone_number;
    if (data.flow_data !== undefined) updates.flow_data = JSON.stringify(data.flow_data);
    if (data.settings !== undefined) updates.settings = JSON.stringify(data.settings);
    if (data.welcome_message !== undefined) updates.welcome_message = data.welcome_message;
    if (data.goodbye_message !== undefined) updates.goodbye_message = data.goodbye_message;
    if (data.error_message !== undefined) updates.error_message = data.error_message;
    if (data.default_language !== undefined) updates.default_language = data.default_language;
    if (data.max_retries !== undefined) updates.max_retries = data.max_retries;
    if (data.input_timeout !== undefined) updates.input_timeout = data.input_timeout;
    if (data.speech_timeout !== undefined) updates.speech_timeout = data.speech_timeout;
    if (data.voice !== undefined) updates.voice = data.voice;
    if (data.status !== undefined) updates.status = data.status;

    await db('ivr_flows').where({ id: flowId }).update(updates);

    // Update nodes if provided
    if (data.nodes && Array.isArray(data.nodes)) {
      await this.saveNodes(flowId, data.nodes);
    }

    return this.getFlowById(flowId);
  }

  /**
   * Delete an IVR flow
   */
  async deleteFlow(flowId) {
    const flow = await db('ivr_flows').where({ id: flowId }).first();
    if (!flow) {
      throw new Error('Flow not found');
    }

    // Check if flow is active
    if (flow.is_active) {
      throw new Error('Cannot delete an active flow. Deactivate it first.');
    }

    // Delete related data (cascades handle most)
    await db('ivr_flows').where({ id: flowId }).delete();

    return { success: true };
  }

  /**
   * Get flow by ID
   */
  async getFlowById(flowId) {
    const flow = await db('ivr_flows').where({ id: flowId }).first();
    if (!flow) {
      return null;
    }

    // Get nodes
    const nodes = await db('ivr_nodes')
      .where({ flow_id: flowId })
      .orderBy('order_index', 'asc');

    return {
      ...flow,
      flow_data: typeof flow.flow_data === 'string' ? JSON.parse(flow.flow_data) : flow.flow_data,
      settings: typeof flow.settings === 'string' ? JSON.parse(flow.settings) : flow.settings,
      nodes: nodes.map(node => ({
        ...node,
        config: typeof node.config === 'string' ? JSON.parse(node.config) : node.config,
        connections: typeof node.connections === 'string' ? JSON.parse(node.connections) : node.connections
      }))
    };
  }

  /**
   * Get flows by organization
   */
  async getFlowsByOrganization(organizationId, options = {}) {
    const { page = 1, limit = 20, status, search } = options;
    const offset = (page - 1) * limit;

    let query = db('ivr_flows')
      .where({ organization_id: organizationId });

    if (status) {
      query = query.where({ status });
    }

    if (search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${search}%`)
          .orWhere('description', 'ilike', `%${search}%`);
      });
    }

    const [flows, countResult] = await Promise.all([
      query.clone()
        .select('*')
        .orderBy('updated_at', 'desc')
        .limit(limit)
        .offset(offset),
      query.clone().count('* as total').first()
    ]);

    return {
      flows: flows.map(flow => ({
        ...flow,
        flow_data: typeof flow.flow_data === 'string' ? JSON.parse(flow.flow_data) : flow.flow_data,
        settings: typeof flow.settings === 'string' ? JSON.parse(flow.settings) : flow.settings
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.total),
        totalPages: Math.ceil(countResult.total / limit)
      }
    };
  }

  /**
   * Get flow by phone number
   */
  async getFlowByPhoneNumber(phoneNumber) {
    const flow = await db('ivr_flows')
      .where({ phone_number: phoneNumber, is_active: true })
      .first();

    if (!flow) {
      return null;
    }

    return this.getFlowById(flow.id);
  }

  /**
   * Activate a flow
   */
  async activateFlow(flowId, userId) {
    const flow = await db('ivr_flows').where({ id: flowId }).first();
    if (!flow) {
      throw new Error('Flow not found');
    }

    // Validate flow before activation
    const validation = await this.validateFlow(flowId);
    if (!validation.isValid) {
      throw new Error(`Flow validation failed: ${validation.errors.join(', ')}`);
    }

    // If phone number is set, deactivate other flows with same number
    if (flow.phone_number) {
      await db('ivr_flows')
        .where({ phone_number: flow.phone_number, is_active: true })
        .whereNot({ id: flowId })
        .update({ is_active: false, updated_at: new Date() });
    }

    await db('ivr_flows').where({ id: flowId }).update({
      is_active: true,
      status: 'published',
      updated_by: userId,
      updated_at: new Date()
    });

    return this.getFlowById(flowId);
  }

  /**
   * Deactivate a flow
   */
  async deactivateFlow(flowId, userId) {
    await db('ivr_flows').where({ id: flowId }).update({
      is_active: false,
      updated_by: userId,
      updated_at: new Date()
    });

    return this.getFlowById(flowId);
  }

  /**
   * Duplicate a flow
   */
  async duplicateFlow(flowId, userId, newName) {
    const originalFlow = await this.getFlowById(flowId);
    if (!originalFlow) {
      throw new Error('Flow not found');
    }

    const duplicateData = {
      name: newName || `${originalFlow.name} (Copy)`,
      description: originalFlow.description,
      flow_data: originalFlow.flow_data,
      settings: originalFlow.settings,
      welcome_message: originalFlow.welcome_message,
      goodbye_message: originalFlow.goodbye_message,
      error_message: originalFlow.error_message,
      default_language: originalFlow.default_language,
      max_retries: originalFlow.max_retries,
      input_timeout: originalFlow.input_timeout,
      speech_timeout: originalFlow.speech_timeout,
      voice: originalFlow.voice,
      nodes: originalFlow.nodes.map(node => ({
        type: node.type,
        name: node.name,
        position_x: node.position_x,
        position_y: node.position_y,
        config: node.config,
        connections: node.connections,
        is_entry_point: node.is_entry_point,
        order_index: node.order_index
      }))
    };

    return this.createFlow(originalFlow.organization_id, duplicateData, userId);
  }

  /**
   * Validate a flow
   */
  async validateFlow(flowId) {
    const flow = await this.getFlowById(flowId);
    if (!flow) {
      return { isValid: false, errors: ['Flow not found'] };
    }

    const errors = [];
    const warnings = [];

    // Check for entry point
    const entryNodes = flow.nodes.filter(n => n.is_entry_point || n.type === 'start');
    if (entryNodes.length === 0) {
      errors.push('Flow must have a start node');
    } else if (entryNodes.length > 1) {
      warnings.push('Flow has multiple entry points');
    }

    // Check for orphan nodes (no incoming connections except start)
    const nodeIds = new Set(flow.nodes.map(n => n.id));
    const connectedNodeIds = new Set();

    flow.nodes.forEach(node => {
      if (node.connections && Array.isArray(node.connections)) {
        node.connections.forEach(conn => {
          if (conn.targetNodeId) {
            connectedNodeIds.add(conn.targetNodeId);
          }
        });
      }
    });

    flow.nodes.forEach(node => {
      if (node.type !== 'start' && !node.is_entry_point && !connectedNodeIds.has(node.id)) {
        warnings.push(`Node "${node.name || node.type}" is not connected`);
      }
    });

    // Check for dead ends (no outgoing connections, not an end node)
    const endTypes = ['hangup', 'end', 'transfer', 'voicemail'];
    flow.nodes.forEach(node => {
      if (!endTypes.includes(node.type)) {
        const hasOutgoing = node.connections && node.connections.length > 0;
        if (!hasOutgoing) {
          warnings.push(`Node "${node.name || node.type}" has no outgoing connections`);
        }
      }
    });

    // Check menu nodes have options
    flow.nodes.forEach(node => {
      if (node.type === 'menu') {
        const options = node.config?.options || [];
        if (options.length === 0) {
          errors.push(`Menu node "${node.name || 'Menu'}" has no options defined`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Save nodes for a flow
   */
  async saveNodes(flowId, nodes) {
    // Delete existing nodes
    await db('ivr_nodes').where({ flow_id: flowId }).delete();

    // Insert new nodes
    if (nodes.length > 0) {
      const nodeRecords = nodes.map((node, index) => ({
        id: node.id || uuidv4(),
        flow_id: flowId,
        type: node.type,
        name: node.name || null,
        position_x: node.position_x || node.position?.x || 0,
        position_y: node.position_y || node.position?.y || 0,
        config: JSON.stringify(node.config || node.data || {}),
        connections: JSON.stringify(node.connections || []),
        is_entry_point: node.is_entry_point || node.type === 'start',
        order_index: index,
        created_at: new Date(),
        updated_at: new Date()
      }));

      await db('ivr_nodes').insert(nodeRecords);
    }
  }

  /**
   * Save flow version for history
   */
  async saveFlowVersion(flow, userId) {
    await db('ivr_flow_versions').insert({
      id: uuidv4(),
      flow_id: flow.id,
      version: flow.version,
      flow_data: flow.flow_data,
      settings: flow.settings,
      created_by: userId,
      created_at: new Date()
    });
  }

  /**
   * Get flow versions
   */
  async getFlowVersions(flowId) {
    return db('ivr_flow_versions')
      .where({ flow_id: flowId })
      .orderBy('version', 'desc');
  }

  /**
   * Restore flow version
   */
  async restoreFlowVersion(flowId, version, userId) {
    const flowVersion = await db('ivr_flow_versions')
      .where({ flow_id: flowId, version })
      .first();

    if (!flowVersion) {
      throw new Error('Version not found');
    }

    return this.updateFlow(flowId, {
      flow_data: typeof flowVersion.flow_data === 'string'
        ? JSON.parse(flowVersion.flow_data)
        : flowVersion.flow_data,
      settings: typeof flowVersion.settings === 'string'
        ? JSON.parse(flowVersion.settings)
        : flowVersion.settings
    }, userId);
  }

  /**
   * Get flow analytics
   */
  async getFlowAnalytics(flowId, options = {}) {
    const { startDate, endDate } = options;

    let sessionsQuery = db('ivr_sessions').where({ flow_id: flowId });
    let analyticsQuery = db('ivr_analytics').where({ flow_id: flowId });

    if (startDate) {
      sessionsQuery = sessionsQuery.where('started_at', '>=', startDate);
      analyticsQuery = analyticsQuery.where('created_at', '>=', startDate);
    }
    if (endDate) {
      sessionsQuery = sessionsQuery.where('started_at', '<=', endDate);
      analyticsQuery = analyticsQuery.where('created_at', '<=', endDate);
    }

    // Get session stats
    const sessionStats = await sessionsQuery.clone()
      .select(
        db.raw('COUNT(*) as total_calls'),
        db.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls"),
        db.raw("COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_calls"),
        db.raw('AVG(duration_seconds) as avg_duration'),
        db.raw('AVG(sentiment_score) as avg_sentiment')
      )
      .first();

    // Get node analytics
    const nodeStats = await db('ivr_analytics')
      .where({ flow_id: flowId })
      .select(
        'node_id',
        db.raw('COUNT(*) as visit_count'),
        db.raw('AVG(duration_ms) as avg_duration')
      )
      .groupBy('node_id');

    // Get menu option stats
    const menuStats = await db('ivr_menu_stats')
      .where({ flow_id: flowId })
      .select('node_id', 'option_key')
      .sum('selection_count as total_selections')
      .groupBy('node_id', 'option_key');

    // Get daily call volume
    const dailyStats = await sessionsQuery.clone()
      .select(
        db.raw("DATE(started_at) as date"),
        db.raw('COUNT(*) as calls')
      )
      .groupBy(db.raw("DATE(started_at)"))
      .orderBy('date', 'desc')
      .limit(30);

    return {
      summary: {
        totalCalls: parseInt(sessionStats.total_calls) || 0,
        completedCalls: parseInt(sessionStats.completed_calls) || 0,
        abandonedCalls: parseInt(sessionStats.abandoned_calls) || 0,
        completionRate: sessionStats.total_calls > 0
          ? (sessionStats.completed_calls / sessionStats.total_calls * 100).toFixed(2)
          : 0,
        avgDuration: Math.round(sessionStats.avg_duration) || 0,
        avgSentiment: sessionStats.avg_sentiment?.toFixed(2) || null
      },
      nodeStats,
      menuStats,
      dailyStats
    };
  }

  /**
   * Increment call count
   */
  async incrementCallCount(flowId) {
    await db('ivr_flows')
      .where({ id: flowId })
      .increment('call_count', 1);
  }
}

module.exports = new IVRService();

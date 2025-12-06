/**
 * Multi-Agent Service
 * High-level service for multi-agent operations
 */

const AgentModel = require('../models/Agent');
const AgentWorkflow = require('../models/AgentWorkflow');
const WorkflowExecution = require('../models/WorkflowExecution');
const AgentExecutionStep = require('../models/AgentExecutionStep');
const WorkflowEngine = require('../agents/workflows/WorkflowEngine');

class MultiAgentService {
  constructor() {
    this.workflowEngine = new WorkflowEngine();
  }

  /**
   * Create default starter agents for a bot
   * @param {number} botId - Bot ID
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Array>} - Created agents
   */
  async createDefaultAgents(botId, organizationId) {
    const defaultAgents = [
      {
        name: 'Router',
        role: 'router',
        system_prompt: 'You are a routing agent. Analyze incoming messages and determine which specialized agent should handle the request. Respond with the agent role that should process this message: "researcher", "writer", or "analyzer".',
        model_provider: 'openai',
        model_name: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 100,
        capabilities: ['routing', 'classification'],
        is_active: true
      },
      {
        name: 'Researcher',
        role: 'researcher',
        system_prompt: 'You are a research agent. When given a topic or question, gather relevant information, analyze it, and provide comprehensive findings. Be thorough and cite your reasoning.',
        model_provider: 'openai',
        model_name: 'gpt-4o-mini',
        temperature: 0.5,
        max_tokens: 1000,
        capabilities: ['research', 'analysis', 'summarization'],
        is_active: true
      },
      {
        name: 'Writer',
        role: 'writer',
        system_prompt: 'You are a writing agent. Take input information and transform it into well-structured, engaging content. Adapt your writing style to the requested format (article, summary, email, etc.).',
        model_provider: 'openai',
        model_name: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 2000,
        capabilities: ['writing', 'formatting', 'editing'],
        is_active: true
      },
      {
        name: 'Analyzer',
        role: 'analyzer',
        system_prompt: 'You are an analysis agent. Examine data, identify patterns, extract insights, and provide actionable recommendations. Be analytical and data-driven in your responses.',
        model_provider: 'openai',
        model_name: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1500,
        capabilities: ['analysis', 'insights', 'recommendations'],
        is_active: true
      }
    ];

    const createdAgents = [];

    for (const agentData of defaultAgents) {
      const agent = await AgentModel.create({
        ...agentData,
        bot_id: botId,
        organization_id: organizationId
      });
      createdAgents.push(agent);
    }

    // Create a default sequential workflow
    const workflow = await AgentWorkflow.create({
      bot_id: botId,
      name: 'Default Workflow',
      workflow_type: 'sequential',
      agents_config: createdAgents.slice(1).map((agent, index) => ({
        agentId: agent.id,
        order: index
      })),
      is_active: true
    });

    return {
      agents: createdAgents,
      workflow
    };
  }

  /**
   * Execute the default workflow for a bot
   * @param {number} botId - Bot ID
   * @param {any} input - Input data
   * @returns {Promise<Object>} - Execution result
   */
  async executeWithBot(botId, input) {
    // Find the default active workflow for this bot
    const workflow = await AgentWorkflow.findByBotId(botId);
    const activeWorkflow = workflow.find(w => w.is_active);

    if (!activeWorkflow) {
      throw new Error(`No active workflow found for bot ${botId}`);
    }

    return this.workflowEngine.execute(activeWorkflow.id, input, botId);
  }

  /**
   * Get agent statistics for a bot
   * @param {number} botId - Bot ID
   * @returns {Promise<Object>} - Statistics
   */
  async getAgentStats(botId) {
    // Get agents count
    const agents = await AgentModel.findByBotId(botId);
    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => a.is_active).length;

    // Get workflows count
    const workflows = await AgentWorkflow.findByBotId(botId);
    const totalWorkflows = workflows.length;
    const activeWorkflows = workflows.filter(w => w.is_active).length;

    // Get execution statistics
    const executions = await this.getExecutionStats(botId);

    // Get agent usage breakdown
    const agentUsage = await this.getAgentUsage(botId);

    return {
      agents: {
        total: totalAgents,
        active: activeAgents,
        byRole: this.groupByRole(agents)
      },
      workflows: {
        total: totalWorkflows,
        active: activeWorkflows,
        byType: this.groupByType(workflows)
      },
      executions: {
        total: executions.total,
        completed: executions.completed,
        failed: executions.failed,
        running: executions.running,
        avgDuration: executions.avgDuration,
        totalTokens: executions.totalTokens
      },
      recentExecutions: executions.recent,
      agentUsage
    };
  }

  /**
   * Get execution statistics for a bot
   */
  async getExecutionStats(botId) {
    const executions = await WorkflowExecution.findByBotId(botId);

    const total = executions.length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const running = executions.filter(e => e.status === 'running').length;

    const completedExecutions = executions.filter(e => e.status === 'completed' && e.duration_ms);
    const avgDuration = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + e.duration_ms, 0) / completedExecutions.length
      : 0;

    const totalTokens = executions.reduce((sum, e) => sum + (e.total_tokens || 0), 0);

    // Get recent executions (last 10)
    const recent = executions
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(e => ({
        id: e.id,
        workflowId: e.workflow_id,
        status: e.status,
        duration: e.duration_ms,
        tokens: e.total_tokens,
        createdAt: e.created_at
      }));

    return {
      total,
      completed,
      failed,
      running,
      avgDuration: Math.round(avgDuration),
      totalTokens,
      recent
    };
  }

  /**
   * Get agent usage statistics
   */
  async getAgentUsage(botId) {
    const agents = await AgentModel.findByBotId(botId);
    const usage = [];

    for (const agent of agents) {
      const steps = await AgentExecutionStep.findByAgentId(agent.id);

      const totalExecutions = steps.length;
      const successCount = steps.filter(s => s.status === 'completed').length;
      const failCount = steps.filter(s => s.status === 'failed').length;
      const totalTokens = steps.reduce((sum, s) => sum + (s.tokens_used || 0), 0);
      const avgDuration = totalExecutions > 0
        ? steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0) / totalExecutions
        : 0;

      usage.push({
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        totalExecutions,
        successCount,
        failCount,
        successRate: totalExecutions > 0 ? (successCount / totalExecutions * 100).toFixed(1) : 0,
        totalTokens,
        avgDuration: Math.round(avgDuration)
      });
    }

    return usage.sort((a, b) => b.totalExecutions - a.totalExecutions);
  }

  /**
   * Group agents by role
   */
  groupByRole(agents) {
    const groups = {};
    for (const agent of agents) {
      const role = agent.role || 'custom';
      groups[role] = (groups[role] || 0) + 1;
    }
    return groups;
  }

  /**
   * Group workflows by type
   */
  groupByType(workflows) {
    const groups = {};
    for (const workflow of workflows) {
      const type = workflow.workflow_type || 'sequential';
      groups[type] = (groups[type] || 0) + 1;
    }
    return groups;
  }

  /**
   * Get quick links for a bot
   */
  getQuickLinks(botId) {
    return [
      { label: 'Agent Studio', path: `/bots/${botId}/agents`, icon: '🎯' },
      { label: 'Workflows', path: `/bots/${botId}/workflows`, icon: '🔄' },
      { label: 'Executions', path: `/bots/${botId}/executions`, icon: '📊' }
    ];
  }
}

module.exports = new MultiAgentService();

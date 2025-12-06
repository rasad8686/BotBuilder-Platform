/**
 * OrchestratorAgent - Routes tasks to other agents, manages workflow
 */

const Agent = require('../core/Agent');

class OrchestratorAgent extends Agent {
  constructor(config) {
    super({
      ...config,
      role: config.role || 'orchestrator',
      systemPrompt: config.systemPrompt || `You are an orchestrator agent responsible for managing complex workflows.

Your responsibilities:
1. Analyze incoming tasks and determine the best approach
2. Decide which specialized agents should handle each part of the task
3. Split complex tasks into manageable subtasks
4. Coordinate the flow of information between agents
5. Synthesize results from multiple agents into a coherent response
6. Use available tools when needed to gather information or perform actions

When analyzing a task, respond with a JSON object:
{
  "taskAnalysis": "Brief description of the task",
  "complexity": "simple|moderate|complex",
  "subtasks": [
    {
      "id": "subtask_1",
      "description": "What needs to be done",
      "assignTo": "agent_role",
      "priority": 1,
      "dependsOn": [],
      "requiredTools": ["tool_name"]
    }
  ],
  "executionStrategy": "sequential|parallel|mixed",
  "expectedOutcome": "What the final result should look like"
}

If you need to use a tool, call it directly and wait for the result before proceeding.`
    });

    this.availableAgents = config.availableAgents || [];
  }

  /**
   * Set available agents for orchestration
   * @param {Array} agents - List of available agents
   */
  setAvailableAgents(agents) {
    this.availableAgents = agents;
  }

  /**
   * Build prompt with available agents context
   */
  buildPrompt(input, context) {
    const basePrompt = super.buildPrompt(input, context);

    // Add available agents information
    if (this.availableAgents.length > 0) {
      const agentsInfo = this.availableAgents.map(a =>
        `- ${a.name} (${a.role}): ${a.capabilities?.join(', ') || 'General purpose'}`
      ).join('\n');

      basePrompt.messages.splice(1, 0, {
        role: 'system',
        content: `Available agents for delegation:\n${agentsInfo}`
      });
    }

    // Add available tools information
    if (this.loadedTools.length > 0) {
      const toolsInfo = this.loadedTools.map(t =>
        `- ${t.name} (${t.type}): ${t.description || 'No description'}`
      ).join('\n');

      basePrompt.messages.splice(1, 0, {
        role: 'system',
        content: `Available tools:\n${toolsInfo}\n\nYou can use these tools to gather information or perform actions. Route tool usage to appropriate agents based on their capabilities.`
      });
    }

    return basePrompt;
  }

  /**
   * Route tool call to appropriate agent
   * @param {string} toolName - Tool name
   * @param {Object} input - Tool input
   * @param {string} targetAgentRole - Target agent role (optional)
   * @returns {Object} - Routing decision
   */
  routeToolCall(toolName, input, targetAgentRole = null) {
    // Find tool
    const tool = this.loadedTools.find(t => t.name === toolName);
    if (!tool) {
      return { routed: false, error: `Tool not found: ${toolName}` };
    }

    // If target role specified, find matching agent
    if (targetAgentRole) {
      const targetAgent = this.availableAgents.find(a => a.role === targetAgentRole);
      if (targetAgent) {
        return {
          routed: true,
          targetAgent: targetAgent.id,
          tool: toolName,
          input
        };
      }
    }

    // Auto-route based on tool type
    const toolTypeToRole = {
      'http_request': 'researcher',
      'web_scraper': 'researcher',
      'database_query': 'analyzer',
      'code_execution': 'analyzer',
      'email': 'writer'
    };

    const recommendedRole = toolTypeToRole[tool.type] || null;
    if (recommendedRole) {
      const targetAgent = this.availableAgents.find(a => a.role === recommendedRole);
      if (targetAgent) {
        return {
          routed: true,
          targetAgent: targetAgent.id,
          tool: toolName,
          input,
          autoRouted: true
        };
      }
    }

    // No routing, execute locally
    return { routed: false, executeLocally: true };
  }

  /**
   * Parse orchestration plan from output
   * @param {Object} output - Agent output
   * @returns {Object} - Parsed plan
   */
  parseOrchestrationPlan(output) {
    try {
      const data = output.type === 'json' ? output.data : JSON.parse(output.raw);
      return {
        valid: true,
        plan: data
      };
    } catch {
      return {
        valid: false,
        error: 'Failed to parse orchestration plan',
        raw: output.raw
      };
    }
  }
}

module.exports = OrchestratorAgent;

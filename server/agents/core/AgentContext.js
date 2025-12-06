/**
 * AgentContext - Shared context between agents in a workflow
 */

class AgentContext {
  constructor(executionId) {
    this.executionId = executionId;
    this.sharedMemory = new Map();
    this.messageHistory = [];
    this.currentAgent = null;
    this.previousAgents = [];
    this.previousOutputs = new Map();
    this.variables = new Map();
  }

  /**
   * Set a value in shared memory
   * @param {string} key - The key to store
   * @param {any} value - The value to store
   */
  set(key, value) {
    this.sharedMemory.set(key, value);
  }

  /**
   * Get a value from shared memory
   * @param {string} key - The key to retrieve
   * @param {any} defaultValue - Default value if key doesn't exist
   * @returns {any} - The stored value or default
   */
  get(key, defaultValue = null) {
    return this.sharedMemory.has(key) ? this.sharedMemory.get(key) : defaultValue;
  }

  /**
   * Add a message to the history
   * @param {Object} message - Message object with fromAgentId, toAgentId, type, content
   */
  addMessage(message) {
    this.messageHistory.push({
      ...message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get messages directed to a specific agent
   * @param {number|string} agentId - The agent ID
   * @returns {Array} - Messages for the agent
   */
  getMessagesFor(agentId) {
    return this.messageHistory.filter(
      msg => msg.toAgentId === agentId || msg.toAgentId === '*'
    );
  }

  /**
   * Get all messages from a specific agent
   * @param {number|string} agentId - The agent ID
   * @returns {Array} - Messages from the agent
   */
  getMessagesFrom(agentId) {
    return this.messageHistory.filter(msg => msg.fromAgentId === agentId);
  }

  /**
   * Add an agent's output to the history
   * @param {number|string} agentId - The agent ID
   * @param {any} output - The agent's output
   */
  addAgentOutput(agentId, output) {
    this.previousOutputs.set(agentId, output);
    if (this.currentAgent) {
      this.previousAgents.push(this.currentAgent);
    }
  }

  /**
   * Get a previous agent's output
   * @param {number|string} agentId - The agent ID
   * @returns {any} - The agent's output or null
   */
  getAgentOutput(agentId) {
    return this.previousOutputs.get(agentId) || null;
  }

  /**
   * Set a variable in the context
   * @param {string} name - Variable name
   * @param {any} value - Variable value
   */
  setVariable(name, value) {
    this.variables.set(name, value);
  }

  /**
   * Get a variable from the context
   * @param {string} name - Variable name
   * @param {any} defaultValue - Default value if not found
   * @returns {any} - The variable value
   */
  getVariable(name, defaultValue = null) {
    return this.variables.has(name) ? this.variables.get(name) : defaultValue;
  }

  /**
   * Set the current executing agent
   * @param {Object} agent - The current agent
   */
  setCurrentAgent(agent) {
    this.currentAgent = agent;
  }

  /**
   * Convert context to a string for including in prompts
   * @returns {string} - Context summary for prompts
   */
  toPromptContext() {
    const parts = [];

    // Add previous agents' outputs
    if (this.previousOutputs.size > 0) {
      parts.push('Previous agent outputs:');
      for (const [agentId, output] of this.previousOutputs) {
        const outputStr = typeof output === 'object' ? JSON.stringify(output) : output;
        parts.push(`- Agent ${agentId}: ${outputStr}`);
      }
    }

    // Add relevant shared memory
    if (this.sharedMemory.size > 0) {
      parts.push('\nShared information:');
      for (const [key, value] of this.sharedMemory) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
        parts.push(`- ${key}: ${valueStr}`);
      }
    }

    // Add variables
    if (this.variables.size > 0) {
      parts.push('\nVariables:');
      for (const [name, value] of this.variables) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
        parts.push(`- ${name}: ${valueStr}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Convert context to JSON for storage
   * @returns {Object} - JSON representation
   */
  toJSON() {
    return {
      executionId: this.executionId,
      sharedMemory: Object.fromEntries(this.sharedMemory),
      messageHistory: this.messageHistory,
      currentAgent: this.currentAgent ? this.currentAgent.toJSON?.() || this.currentAgent : null,
      previousAgents: this.previousAgents.map(a => a.toJSON?.() || a),
      previousOutputs: Object.fromEntries(this.previousOutputs),
      variables: Object.fromEntries(this.variables)
    };
  }

  /**
   * Create a context from JSON
   * @param {Object} json - JSON representation
   * @returns {AgentContext} - Restored context
   */
  static fromJSON(json) {
    const context = new AgentContext(json.executionId);

    if (json.sharedMemory) {
      for (const [key, value] of Object.entries(json.sharedMemory)) {
        context.sharedMemory.set(key, value);
      }
    }

    if (json.messageHistory) {
      context.messageHistory = json.messageHistory;
    }

    if (json.previousOutputs) {
      for (const [key, value] of Object.entries(json.previousOutputs)) {
        context.previousOutputs.set(key, value);
      }
    }

    if (json.variables) {
      for (const [key, value] of Object.entries(json.variables)) {
        context.variables.set(key, value);
      }
    }

    context.currentAgent = json.currentAgent;
    context.previousAgents = json.previousAgents || [];

    return context;
  }

  /**
   * Clear all context data
   */
  clear() {
    this.sharedMemory.clear();
    this.messageHistory = [];
    this.currentAgent = null;
    this.previousAgents = [];
    this.previousOutputs.clear();
    this.variables.clear();
  }
}

module.exports = AgentContext;

/**
 * AgentRegistry - Agent storage and lookup
 */

class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.roleIndex = new Map();
  }

  /**
   * Register an agent in the registry
   * @param {Agent} agent - The agent to register
   * @returns {boolean} - True if registered successfully
   */
  register(agent) {
    if (!agent || !agent.id) {
      throw new Error('Agent must have an id');
    }

    this.agents.set(agent.id, agent);

    // Index by role
    if (agent.role) {
      if (!this.roleIndex.has(agent.role)) {
        this.roleIndex.set(agent.role, new Set());
      }
      this.roleIndex.get(agent.role).add(agent.id);
    }

    return true;
  }

  /**
   * Get an agent by ID
   * @param {number|string} id - The agent ID
   * @returns {Agent|null} - The agent or null if not found
   */
  get(id) {
    return this.agents.get(id) || null;
  }

  /**
   * Get all registered agents
   * @returns {Array<Agent>} - Array of all agents
   */
  getAll() {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by role
   * @param {string} role - The role to filter by
   * @returns {Array<Agent>} - Agents with the specified role
   */
  getByRole(role) {
    const agentIds = this.roleIndex.get(role);
    if (!agentIds) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(Boolean);
  }

  /**
   * Remove an agent from the registry
   * @param {number|string} id - The agent ID to remove
   * @returns {boolean} - True if removed, false if not found
   */
  remove(id) {
    const agent = this.agents.get(id);
    if (!agent) {
      return false;
    }

    // Remove from role index
    if (agent.role && this.roleIndex.has(agent.role)) {
      this.roleIndex.get(agent.role).delete(id);
      if (this.roleIndex.get(agent.role).size === 0) {
        this.roleIndex.delete(agent.role);
      }
    }

    this.agents.delete(id);
    return true;
  }

  /**
   * Clear all agents from the registry
   */
  clear() {
    this.agents.clear();
    this.roleIndex.clear();
  }

  /**
   * Check if an agent exists
   * @param {number|string} id - The agent ID
   * @returns {boolean} - True if agent exists
   */
  has(id) {
    return this.agents.has(id);
  }

  /**
   * Get the count of registered agents
   * @returns {number} - Number of registered agents
   */
  count() {
    return this.agents.size;
  }

  /**
   * Get all unique roles
   * @returns {Array<string>} - Array of role names
   */
  getRoles() {
    return Array.from(this.roleIndex.keys());
  }

  /**
   * Find agents matching criteria
   * @param {Function} predicate - Filter function
   * @returns {Array<Agent>} - Matching agents
   */
  find(predicate) {
    return this.getAll().filter(predicate);
  }

  /**
   * Convert registry to JSON
   * @returns {Array<Object>} - JSON representation
   */
  toJSON() {
    return this.getAll().map(agent => agent.toJSON?.() || agent);
  }
}

module.exports = AgentRegistry;

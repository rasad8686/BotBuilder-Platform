/**
 * ContextManager - Manages shared context across workflow
 */

const AgentContext = require('../core/AgentContext');

class ContextManager {
  constructor() {
    this.contexts = new Map();
    this.persistedContexts = new Map();
  }

  /**
   * Create a new context for an execution
   * @param {string} executionId - Execution ID
   * @param {Object} initialData - Initial context data
   * @returns {AgentContext} - Created context
   */
  create(executionId, initialData = {}) {
    const context = new AgentContext(executionId);

    // Set initial data
    for (const [key, value] of Object.entries(initialData)) {
      context.set(key, value);
    }

    this.contexts.set(executionId, context);

    return context;
  }

  /**
   * Get context for an execution
   * @param {string} executionId - Execution ID
   * @returns {AgentContext|null} - Context or null
   */
  get(executionId) {
    return this.contexts.get(executionId) || null;
  }

  /**
   * Update context with new data
   * @param {string} executionId - Execution ID
   * @param {Object} data - Data to update
   * @returns {AgentContext} - Updated context
   */
  update(executionId, data) {
    let context = this.contexts.get(executionId);

    if (!context) {
      context = this.create(executionId);
    }

    for (const [key, value] of Object.entries(data)) {
      context.set(key, value);
    }

    return context;
  }

  /**
   * Merge contexts from parallel agents
   * @param {string} executionId - Execution ID
   * @param {Array<Object>} parallelOutputs - Outputs from parallel agents
   * @param {Object} mergeStrategy - How to merge conflicting values
   * @returns {AgentContext} - Merged context
   */
  merge(executionId, parallelOutputs, mergeStrategy = {}) {
    let context = this.contexts.get(executionId);

    if (!context) {
      context = this.create(executionId);
    }

    // Default merge strategies
    const strategies = {
      arrays: mergeStrategy.arrays || 'concat',     // concat, first, last, unique
      objects: mergeStrategy.objects || 'deep',     // deep, shallow, first, last
      primitives: mergeStrategy.primitives || 'last', // first, last
      ...mergeStrategy
    };

    for (const output of parallelOutputs) {
      if (!output) continue;

      const data = output.data || output;

      for (const [key, value] of Object.entries(data)) {
        const existing = context.get(key);

        if (existing === null) {
          context.set(key, value);
        } else {
          const merged = this.mergeValues(existing, value, strategies);
          context.set(key, merged);
        }
      }
    }

    // Store merged parallel outputs
    context.set('_parallelOutputs', parallelOutputs);

    return context;
  }

  /**
   * Merge two values based on strategy
   */
  mergeValues(existing, newValue, strategies) {
    // Handle arrays
    if (Array.isArray(existing) && Array.isArray(newValue)) {
      switch (strategies.arrays) {
        case 'concat':
          return [...existing, ...newValue];
        case 'first':
          return existing;
        case 'last':
          return newValue;
        case 'unique':
          return [...new Set([...existing, ...newValue])];
        default:
          return [...existing, ...newValue];
      }
    }

    // Handle objects
    if (typeof existing === 'object' && typeof newValue === 'object' &&
        !Array.isArray(existing) && !Array.isArray(newValue) &&
        existing !== null && newValue !== null) {
      switch (strategies.objects) {
        case 'deep':
          return this.deepMerge(existing, newValue, strategies);
        case 'shallow':
          return { ...existing, ...newValue };
        case 'first':
          return existing;
        case 'last':
          return newValue;
        default:
          return this.deepMerge(existing, newValue, strategies);
      }
    }

    // Handle primitives
    switch (strategies.primitives) {
      case 'first':
        return existing;
      case 'last':
        return newValue;
      default:
        return newValue;
    }
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source, strategies) {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      if (key in result) {
        result[key] = this.mergeValues(result[key], source[key], strategies);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Save context to persistent storage
   * @param {string} executionId - Execution ID
   * @returns {Object} - Saved context data
   */
  save(executionId) {
    const context = this.contexts.get(executionId);

    if (!context) {
      throw new Error(`Context not found: ${executionId}`);
    }

    const data = context.toJSON();
    this.persistedContexts.set(executionId, data);

    return data;
  }

  /**
   * Load context from persistent storage
   * @param {string} executionId - Execution ID
   * @returns {AgentContext|null} - Loaded context
   */
  load(executionId) {
    const data = this.persistedContexts.get(executionId);

    if (!data) {
      return null;
    }

    const context = AgentContext.fromJSON(data);
    this.contexts.set(executionId, context);

    return context;
  }

  /**
   * Delete context
   * @param {string} executionId - Execution ID
   */
  delete(executionId) {
    this.contexts.delete(executionId);
    this.persistedContexts.delete(executionId);
  }

  /**
   * Clear all contexts
   */
  clear() {
    this.contexts.clear();
    this.persistedContexts.clear();
  }

  /**
   * Get context snapshot
   * @param {string} executionId - Execution ID
   * @returns {Object} - Context snapshot
   */
  getSnapshot(executionId) {
    const context = this.contexts.get(executionId);

    if (!context) {
      return null;
    }

    return context.toJSON();
  }

  /**
   * Create a child context
   * @param {string} parentExecutionId - Parent execution ID
   * @param {string} childExecutionId - Child execution ID
   * @returns {AgentContext} - Child context
   */
  createChild(parentExecutionId, childExecutionId) {
    const parentContext = this.contexts.get(parentExecutionId);

    if (!parentContext) {
      throw new Error(`Parent context not found: ${parentExecutionId}`);
    }

    const childContext = this.create(childExecutionId);

    // Copy shared memory from parent
    const parentData = parentContext.toJSON();
    for (const [key, value] of Object.entries(parentData.sharedMemory)) {
      childContext.set(key, value);
    }

    // Link to parent
    childContext.set('_parentExecutionId', parentExecutionId);

    return childContext;
  }

  /**
   * Get all active contexts
   * @returns {Array} - List of active execution IDs
   */
  getActiveContexts() {
    return Array.from(this.contexts.keys());
  }

  /**
   * Get context statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      activeContexts: this.contexts.size,
      persistedContexts: this.persistedContexts.size
    };
  }
}

module.exports = ContextManager;

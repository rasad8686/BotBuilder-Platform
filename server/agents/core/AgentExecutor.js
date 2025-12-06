/**
 * AgentExecutor - Executes individual agents and manages execution flow
 */

const AgentContext = require('./AgentContext');
const ToolCallParser = require('./ToolCallParser');

class AgentExecutor {
  constructor(registry) {
    this.registry = registry;
    this.toolCallParser = new ToolCallParser();
    this.maxToolIterations = 10; // Prevent infinite tool loops
  }

  /**
   * Execute a single agent
   * @param {Agent} agent - The agent to execute
   * @param {any} input - Input for the agent
   * @param {AgentContext} context - Shared context
   * @returns {Promise<Object>} - Execution result
   */
  async executeAgent(agent, input, context) {
    if (!agent) {
      throw new Error('Agent is required');
    }

    // Set current agent in context
    context.setCurrentAgent(agent);

    try {
      // Load tools for agent if not already loaded
      if (agent.loadedTools.length === 0) {
        await agent.loadTools();
      }

      // Execute the agent with tool support
      const result = agent.loadedTools.length > 0
        ? await this.executeWithTools(agent, input, context)
        : await agent.execute(input, context);

      // Store the output in context
      if (result.success) {
        context.addAgentOutput(agent.id, result.output);
      }

      return {
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        ...result
      };
    } catch (error) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute agent with tool support
   * @param {Agent} agent - The agent to execute
   * @param {any} input - Input for the agent
   * @param {AgentContext} context - Shared context
   * @returns {Promise<Object>} - Execution result with tool calls
   */
  async executeWithTools(agent, input, context) {
    const startTime = Date.now();
    const toolResults = [];
    let totalTokens = 0;
    let iterations = 0;
    let currentInput = input;
    let messages = [];

    try {
      while (iterations < this.maxToolIterations) {
        iterations++;

        // Build prompt and call LLM
        const prompt = agent.buildPrompt(currentInput, context);

        // Add previous tool results to messages
        if (messages.length > 0) {
          prompt.messages = prompt.messages.concat(messages);
        }

        const response = await agent.callLLM(prompt);
        totalTokens += response.tokensUsed || 0;

        // Check for tool calls in response
        const toolCalls = this.detectToolCalls(response);

        if (toolCalls.length === 0) {
          // No tool calls, return final response
          const output = agent.formatOutput(response);
          return {
            success: true,
            output,
            toolResults,
            iterations,
            tokensUsed: totalTokens,
            durationMs: Date.now() - startTime
          };
        }

        // Execute tool calls
        for (const toolCall of toolCalls) {
          const parsed = this.toolCallParser.parseToolCall(toolCall);

          if (!parsed.valid) {
            toolResults.push({
              toolName: parsed.name || 'unknown',
              success: false,
              error: parsed.error
            });
            continue;
          }

          // Execute the tool
          const toolResult = await agent.executeTool(parsed.name, parsed.arguments, {
            executionId: context.executionId,
            agentId: agent.id
          });

          toolResults.push(toolResult);

          // Add tool result to messages for next iteration
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: toolCall.id || `call_${Date.now()}`,
              type: 'function',
              function: {
                name: parsed.name,
                arguments: JSON.stringify(parsed.arguments)
              }
            }]
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id || `call_${Date.now()}`,
            content: this.handleToolResult(toolResult)
          });
        }

        // Continue with tool results as new context
        currentInput = {
          original: input,
          toolResults: toolResults.slice(-toolCalls.length)
        };
      }

      // Max iterations reached
      return {
        success: true,
        output: {
          type: 'text',
          data: 'Maximum tool iterations reached',
          raw: 'Maximum tool iterations reached'
        },
        toolResults,
        iterations,
        tokensUsed: totalTokens,
        durationMs: Date.now() - startTime,
        warning: 'Max tool iterations reached'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        toolResults,
        iterations,
        tokensUsed: totalTokens,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * Detect tool calls from LLM response
   * @param {Object} response - LLM response
   * @returns {Array} - Array of tool calls
   */
  detectToolCalls(response) {
    const toolCalls = [];

    // Check for OpenAI/Anthropic format tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      toolCalls.push(...response.toolCalls);
    }

    // Check for custom format in content
    if (response.content) {
      const customCalls = this.toolCallParser.extractToolCalls(response.content);
      toolCalls.push(...customCalls);
    }

    return toolCalls;
  }

  /**
   * Handle tool result and format for LLM
   * @param {Object} result - Tool execution result
   * @returns {string} - Formatted result string
   */
  handleToolResult(result) {
    if (!result.success) {
      return JSON.stringify({
        error: true,
        message: result.error
      });
    }

    return JSON.stringify({
      success: true,
      data: result.result
    });
  }

  /**
   * Execute agents sequentially
   * @param {Array<Agent>} agents - Agents to execute in order
   * @param {any} initialInput - Initial input for first agent
   * @param {AgentContext} context - Shared context
   * @returns {Promise<Object>} - Execution results
   */
  async executeSequential(agents, initialInput, context) {
    const results = [];
    let currentInput = initialInput;
    let totalTokens = 0;
    let totalDuration = 0;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];

      const result = await this.executeAgent(agent, currentInput, context);
      results.push({
        stepOrder: i,
        ...result
      });

      totalTokens += result.tokensUsed || 0;
      totalDuration += result.durationMs || 0;

      // If agent failed, stop the sequence
      if (!result.success) {
        return {
          success: false,
          completedSteps: i,
          totalSteps: agents.length,
          results,
          totalTokens,
          totalDuration,
          error: `Agent ${agent.name} failed: ${result.error}`
        };
      }

      // Use this agent's output as input for the next agent
      currentInput = result.output;
    }

    return {
      success: true,
      completedSteps: agents.length,
      totalSteps: agents.length,
      results,
      totalTokens,
      totalDuration,
      finalOutput: results[results.length - 1]?.output
    };
  }

  /**
   * Execute agents in parallel
   * @param {Array<Agent>} agents - Agents to execute in parallel
   * @param {any} input - Input for all agents
   * @param {AgentContext} context - Shared context
   * @returns {Promise<Object>} - Execution results
   */
  async executeParallel(agents, input, context) {
    const startTime = Date.now();

    // Create a separate context clone for each agent to avoid race conditions
    const executions = agents.map(async (agent, index) => {
      try {
        const result = await this.executeAgent(agent, input, context);
        return {
          stepOrder: index,
          ...result
        };
      } catch (error) {
        return {
          stepOrder: index,
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(executions);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalTokens = results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    return {
      success: failed.length === 0,
      completedSteps: successful.length,
      totalSteps: agents.length,
      results,
      successful,
      failed,
      totalTokens,
      totalDuration: Date.now() - startTime,
      outputs: successful.map(r => r.output)
    };
  }

  /**
   * Execute agents with dependencies (DAG execution)
   * @param {Array<Object>} agentConfigs - Agent configs with dependencies
   * @param {any} initialInput - Initial input
   * @param {AgentContext} context - Shared context
   * @returns {Promise<Object>} - Execution results
   */
  async executeWithDependencies(agentConfigs, initialInput, context) {
    const completed = new Set();
    const results = new Map();
    const startTime = Date.now();

    // Helper to check if dependencies are met
    const dependenciesMet = (config) => {
      if (!config.dependsOn || config.dependsOn.length === 0) {
        return true;
      }
      return config.dependsOn.every(depId => completed.has(depId));
    };

    // Helper to get input for an agent based on dependencies
    const getInput = (config) => {
      if (!config.dependsOn || config.dependsOn.length === 0) {
        return initialInput;
      }

      // Combine outputs from dependencies
      const depOutputs = config.dependsOn.map(depId => results.get(depId)?.output);
      return depOutputs.length === 1 ? depOutputs[0] : { dependencies: depOutputs };
    };

    let remaining = [...agentConfigs];
    const allResults = [];

    while (remaining.length > 0) {
      // Find agents that can be executed
      const ready = remaining.filter(dependenciesMet);

      if (ready.length === 0 && remaining.length > 0) {
        throw new Error('Circular dependency detected or unmet dependencies');
      }

      // Execute ready agents in parallel
      const executions = ready.map(async (config) => {
        const agent = this.registry.get(config.agentId);
        if (!agent) {
          throw new Error(`Agent not found: ${config.agentId}`);
        }

        const input = getInput(config);
        return this.executeAgent(agent, input, context);
      });

      const batchResults = await Promise.all(executions);

      // Process results
      for (let i = 0; i < ready.length; i++) {
        const config = ready[i];
        const result = batchResults[i];

        completed.add(config.agentId);
        results.set(config.agentId, result);
        allResults.push(result);

        if (!result.success) {
          return {
            success: false,
            error: `Agent ${config.agentId} failed: ${result.error}`,
            results: allResults,
            totalDuration: Date.now() - startTime
          };
        }
      }

      // Remove executed agents from remaining
      remaining = remaining.filter(config => !completed.has(config.agentId));
    }

    const totalTokens = allResults.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    return {
      success: true,
      results: allResults,
      totalTokens,
      totalDuration: Date.now() - startTime
    };
  }
}

module.exports = AgentExecutor;

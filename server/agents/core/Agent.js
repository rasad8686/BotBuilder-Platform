/**
 * Base Agent class for Multi-Agent AI system
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const AgentTool = require('../../models/AgentTool');
const Tool = require('../../models/Tool');
const { createTool } = require('../../tools/types');
const log = require('../../utils/logger');

class Agent {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.modelProvider = config.modelProvider || 'openai';
    this.modelName = config.modelName || 'gpt-4';
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens || 2048;
    this.capabilities = config.capabilities || [];
    this.tools = config.tools || [];

    // Tool support
    this.loadedTools = []; // Loaded tool instances
    this.toolDefinitions = []; // LLM-ready tool definitions

    // Initialize LLM clients
    this.openaiClient = null;
    this.anthropicClient = null;
  }

  /**
   * Load tools assigned to this agent from database
   * @returns {Promise<Array>} - Loaded tools
   */
  async loadTools() {
    if (!this.id) {
      return [];
    }

    try {
      const assignments = await AgentTool.findEnabledByAgentId(this.id);
      this.loadedTools = [];
      this.toolDefinitions = [];

      for (const assignment of assignments) {
        const tool = await Tool.findById(assignment.tool_id);
        if (tool && tool.is_active) {
          // Create tool instance
          const toolInstance = createTool(tool.tool_type, tool.configuration);

          this.loadedTools.push({
            id: tool.id,
            name: tool.name,
            description: tool.description,
            type: tool.tool_type,
            instance: toolInstance,
            inputSchema: tool.input_schema,
            outputSchema: tool.output_schema,
            priority: assignment.priority
          });

          // Build LLM-ready definition
          this.toolDefinitions.push(this.buildToolDefinition(tool));
        }
      }

      // Sort by priority
      this.loadedTools.sort((a, b) => b.priority - a.priority);

      return this.loadedTools;
    } catch (error) {
      log.error('Error loading tools for agent:', { error: error.message, agentId: this.id });
      return [];
    }
  }

  /**
   * Build LLM-ready tool definition
   * @param {Object} tool - Tool from database
   * @returns {Object} - LLM-ready definition
   */
  buildToolDefinition(tool) {
    // Convert input schema to function parameters
    const parameters = tool.input_schema || {
      type: 'object',
      properties: {},
      required: []
    };

    return {
      name: tool.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
      description: tool.description || `Execute ${tool.name} tool`,
      parameters,
      toolId: tool.id,
      toolType: tool.tool_type
    };
  }

  /**
   * Get available tools for this agent
   * @returns {Array} - Available tools
   */
  getAvailableTools() {
    return this.loadedTools.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      type: t.type,
      inputSchema: t.inputSchema
    }));
  }

  /**
   * Execute a tool by name
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} input - Input for the tool
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Tool execution result
   */
  async executeTool(toolName, input, context = {}) {
    const tool = this.loadedTools.find(t =>
      t.name === toolName || t.name.replace(/[^a-zA-Z0-9_-]/g, '_') === toolName
    );

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
        availableTools: this.loadedTools.map(t => t.name)
      };
    }

    try {
      const startTime = Date.now();
      const result = await tool.instance.execute(input, {
        ...context,
        agentId: this.id
      });

      return {
        success: true,
        toolName: tool.name,
        toolId: tool.id,
        result,
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        toolName: tool.name,
        toolId: tool.id,
        error: error.message
      };
    }
  }

  /**
   * Build OpenAI function definitions
   * @returns {Array} - OpenAI functions array
   */
  buildOpenAIFunctions() {
    return this.toolDefinitions.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * Build Anthropic tool definitions
   * @returns {Array} - Anthropic tools array
   */
  buildAnthropicTools() {
    return this.toolDefinitions.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  /**
   * Initialize OpenAI client
   */
  getOpenAIClient() {
    if (!this.openaiClient) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    return this.openaiClient;
  }

  /**
   * Initialize Anthropic client
   */
  getAnthropicClient() {
    if (!this.anthropicClient) {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
    return this.anthropicClient;
  }

  /**
   * Execute the agent with given input and context
   * @param {any} input - The input to process
   * @param {AgentContext} context - Shared context between agents
   * @returns {Promise<Object>} - Execution result
   */
  async execute(input, context) {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(input, context);
      const response = await this.callLLM(prompt);
      const output = this.formatOutput(response);

      return {
        success: true,
        output,
        tokensUsed: response.tokensUsed || 0,
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * Build the prompt for the LLM
   * @param {any} input - The input to process
   * @param {AgentContext} context - Shared context
   * @returns {Object} - Prompt configuration
   */
  buildPrompt(input, context) {
    const messages = [
      {
        role: 'system',
        content: this.systemPrompt
      }
    ];

    // Add context from previous agents if available
    if (context) {
      const contextInfo = context.toPromptContext();
      if (contextInfo) {
        messages.push({
          role: 'system',
          content: `Previous context:\n${contextInfo}`
        });
      }

      // Add messages directed to this agent
      const agentMessages = context.getMessagesFor(this.id);
      for (const msg of agentMessages) {
        messages.push({
          role: 'assistant',
          content: `Message from ${msg.fromAgentName}: ${JSON.stringify(msg.content)}`
        });
      }
    }

    // Add the main input
    messages.push({
      role: 'user',
      content: typeof input === 'string' ? input : JSON.stringify(input)
    });

    return { messages };
  }

  /**
   * Call the LLM with the given prompt
   * @param {Object} prompt - The prompt configuration
   * @returns {Promise<Object>} - LLM response
   */
  async callLLM(prompt) {
    if (this.modelProvider === 'openai') {
      return this.callOpenAI(prompt);
    } else if (this.modelProvider === 'anthropic') {
      return this.callAnthropic(prompt);
    } else {
      throw new Error(`Unsupported model provider: ${this.modelProvider}`);
    }
  }

  /**
   * Call OpenAI API
   * @param {Object} prompt - The prompt configuration
   * @returns {Promise<Object>} - Response with content and token usage
   */
  async callOpenAI(prompt) {
    const client = this.getOpenAIClient();

    const requestOptions = {
      model: this.modelName,
      messages: prompt.messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens
    };

    // Add tools if available
    if (this.toolDefinitions.length > 0) {
      requestOptions.tools = this.buildOpenAIFunctions().map(fn => ({
        type: 'function',
        function: fn
      }));
      requestOptions.tool_choice = 'auto';
    }

    const response = await client.chat.completions.create(requestOptions);

    const message = response.choices[0].message;

    return {
      content: message.content,
      toolCalls: message.tool_calls || [],
      tokensUsed: response.usage?.total_tokens || 0,
      raw: response
    };
  }

  /**
   * Call Anthropic API
   * @param {Object} prompt - The prompt configuration
   * @returns {Promise<Object>} - Response with content and token usage
   */
  async callAnthropic(prompt) {
    const client = this.getAnthropicClient();

    // Extract system message and user messages for Anthropic format
    const systemMessage = prompt.messages.find(m => m.role === 'system');
    const otherMessages = prompt.messages.filter(m => m.role !== 'system');

    // Combine all system messages
    const systemContent = prompt.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n');

    // Convert messages to Anthropic format
    const anthropicMessages = otherMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    // Ensure messages alternate between user and assistant
    if (anthropicMessages.length === 0 || anthropicMessages[0].role !== 'user') {
      anthropicMessages.unshift({
        role: 'user',
        content: 'Please proceed with the task.'
      });
    }

    const requestOptions = {
      model: this.modelName,
      max_tokens: this.maxTokens,
      system: systemContent,
      messages: anthropicMessages
    };

    // Add tools if available
    if (this.toolDefinitions.length > 0) {
      requestOptions.tools = this.buildAnthropicTools();
    }

    const response = await client.messages.create(requestOptions);

    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    // Extract tool use blocks
    const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
    const textBlocks = response.content.filter(block => block.type === 'text');

    return {
      content: textBlocks.map(b => b.text).join('\n'),
      toolCalls: toolUseBlocks.map(block => ({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input)
        }
      })),
      stopReason: response.stop_reason,
      tokensUsed,
      raw: response
    };
  }

  /**
   * Format the LLM response output
   * @param {Object} response - The LLM response
   * @returns {Object} - Formatted output
   */
  formatOutput(response) {
    const content = response.content;

    // Try to parse as JSON if possible
    try {
      const parsed = JSON.parse(content);
      return {
        type: 'json',
        data: parsed,
        raw: content
      };
    } catch {
      // Return as text if not valid JSON
      return {
        type: 'text',
        data: content,
        raw: content
      };
    }
  }

  /**
   * Get agent info for serialization
   * @returns {Object} - Agent information
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      modelProvider: this.modelProvider,
      modelName: this.modelName,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      capabilities: this.capabilities,
      tools: this.tools
    };
  }
}

module.exports = Agent;

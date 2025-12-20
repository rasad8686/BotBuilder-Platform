/**
 * Tool Registry for Autonomous Agents
 * Manages available tools that agents can use during task execution
 */

const log = require('../../utils/logger');
const { safeMathEval } = require('../../utils/codeSandbox');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.registerBuiltInTools();
  }

  /**
   * Register built-in tools
   */
  registerBuiltInTools() {
    // Web Search Tool
    this.register({
      name: 'web_search',
      description: 'Search the web for information',
      parameters: {
        query: { type: 'string', required: true, description: 'Search query' },
        limit: { type: 'number', required: false, description: 'Max results', default: 5 }
      },
      execute: async (params) => {
        // Simulated web search for demo
        const results = [
          { title: `Result for "${params.query}"`, snippet: 'Sample search result content...' }
        ];
        return { success: true, results };
      }
    });

    // Text Analysis Tool
    this.register({
      name: 'analyze_text',
      description: 'Analyze and extract information from text',
      parameters: {
        text: { type: 'string', required: true, description: 'Text to analyze' },
        analysis_type: { type: 'string', required: false, description: 'Type of analysis', default: 'summary' }
      },
      execute: async (params) => {
        return {
          success: true,
          analysis: {
            word_count: params.text.split(/\s+/).length,
            char_count: params.text.length,
            type: params.analysis_type
          }
        };
      }
    });

    // Data Formatter Tool
    this.register({
      name: 'format_data',
      description: 'Format data into structured output',
      parameters: {
        data: { type: 'any', required: true, description: 'Data to format' },
        format: { type: 'string', required: false, description: 'Output format', default: 'json' }
      },
      execute: async (params) => {
        const { data, format } = params;
        let formatted;

        switch (format) {
          case 'json':
            formatted = JSON.stringify(data, null, 2);
            break;
          case 'list':
            formatted = Array.isArray(data) ? data.map((item, i) => `${i + 1}. ${item}`).join('\n') : String(data);
            break;
          case 'table':
            if (Array.isArray(data) && data.length > 0) {
              const headers = Object.keys(data[0]);
              const rows = data.map(row => headers.map(h => row[h]).join(' | '));
              formatted = [headers.join(' | '), '-'.repeat(40), ...rows].join('\n');
            } else {
              formatted = String(data);
            }
            break;
          default:
            formatted = String(data);
        }

        return { success: true, formatted };
      }
    });

    // Calculator Tool
    // SECURITY: Uses sandboxed math evaluation instead of Function()
    this.register({
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        expression: { type: 'string', required: true, description: 'Mathematical expression' }
      },
      execute: async (params) => {
        // SECURITY: Use safe math evaluator (no Function constructor!)
        return safeMathEval(params.expression);
      }
    });

    // List Generator Tool
    this.register({
      name: 'generate_list',
      description: 'Generate a list of items',
      parameters: {
        items: { type: 'array', required: true, description: 'List items' },
        title: { type: 'string', required: false, description: 'List title' }
      },
      execute: async (params) => {
        const { items, title } = params;
        let output = title ? `${title}:\n` : '';
        output += items.map((item, i) => `${i + 1}. ${item}`).join('\n');
        return { success: true, output };
      }
    });

    // Note/Memory Tool
    this.register({
      name: 'save_note',
      description: 'Save a note or intermediate result',
      parameters: {
        key: { type: 'string', required: true, description: 'Note identifier' },
        value: { type: 'any', required: true, description: 'Note content' }
      },
      execute: async (params, context) => {
        if (!context.notes) context.notes = {};
        context.notes[params.key] = params.value;
        return { success: true, message: `Saved note: ${params.key}` };
      }
    });

    // Retrieve Note Tool
    this.register({
      name: 'get_note',
      description: 'Retrieve a previously saved note',
      parameters: {
        key: { type: 'string', required: true, description: 'Note identifier' }
      },
      execute: async (params, context) => {
        if (!context.notes || !context.notes[params.key]) {
          return { success: false, error: `Note not found: ${params.key}` };
        }
        return { success: true, value: context.notes[params.key] };
      }
    });

    log.info('ToolRegistry: Built-in tools registered', { count: this.tools.size });
  }

  /**
   * Register a new tool
   */
  register(tool) {
    if (!tool.name || !tool.execute) {
      throw new Error('Tool must have name and execute function');
    }

    this.tools.set(tool.name, {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || {},
      execute: tool.execute
    });

    log.debug('ToolRegistry: Tool registered', { name: tool.name });
  }

  /**
   * Unregister a tool
   */
  unregister(name) {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name) {
    return this.tools.has(name);
  }

  /**
   * Get all available tools
   */
  getAll() {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions for AI (OpenAI function format)
   */
  getToolDefinitions() {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.entries(tool.parameters).reduce((acc, [key, param]) => {
            acc[key] = {
              type: param.type === 'any' ? 'string' : param.type,
              description: param.description
            };
            if (param.default !== undefined) {
              acc[key].default = param.default;
            }
            return acc;
          }, {}),
          required: Object.entries(tool.parameters)
            .filter(([, param]) => param.required)
            .map(([key]) => key)
        }
      }
    }));
  }

  /**
   * Execute a tool
   */
  async execute(name, params, context = {}) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    log.debug('ToolRegistry: Executing tool', { name, params });

    try {
      const result = await tool.execute(params, context);
      log.debug('ToolRegistry: Tool executed', { name, success: result.success });
      return result;
    } catch (error) {
      log.error('ToolRegistry: Tool execution failed', { name, error: error.message });
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const toolRegistry = new ToolRegistry();

module.exports = toolRegistry;

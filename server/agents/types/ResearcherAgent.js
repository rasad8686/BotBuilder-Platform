/**
 * ResearcherAgent - Gathers and synthesizes information
 */

const Agent = require('../core/Agent');
const log = require('../../utils/logger');

class ResearcherAgent extends Agent {
  constructor(config) {
    super({
      ...config,
      role: config.role || 'researcher',
      systemPrompt: config.systemPrompt || `You are a research agent specialized in gathering and synthesizing information.

Your responsibilities:
1. Analyze research queries and identify key topics
2. Search through available knowledge and context
3. Gather relevant information from multiple sources using available tools
4. Synthesize findings into clear, structured summaries
5. Identify gaps in information and note uncertainties

Available tool types you can use:
- HTTP/API tools: Make requests to external APIs
- Web scraper tools: Extract data from websites
- Database tools: Query databases for information

When conducting research, respond with a JSON object:
{
  "query": "The original research question",
  "keyTopics": ["topic1", "topic2"],
  "toolsUsed": ["tool_name1", "tool_name2"],
  "findings": [
    {
      "topic": "Topic name",
      "summary": "Key findings about this topic",
      "confidence": "high|medium|low",
      "sources": ["source1", "source2"],
      "toolSource": "tool_name or null"
    }
  ],
  "synthesis": "Overall summary combining all findings",
  "gaps": ["Information that could not be found"],
  "recommendations": ["Suggested next steps or additional research"]
}

Use tools proactively to gather accurate, up-to-date information.`
    });

    this.knowledgeBase = config.knowledgeBase || null;
  }

  /**
   * Set knowledge base for research
   * @param {Object} knowledgeBase - Knowledge base reference
   */
  setKnowledgeBase(knowledgeBase) {
    this.knowledgeBase = knowledgeBase;
  }

  /**
   * Build prompt with knowledge context
   */
  buildPrompt(input, context) {
    const basePrompt = super.buildPrompt(input, context);

    // Add knowledge base context if available
    if (this.knowledgeBase) {
      basePrompt.messages.splice(1, 0, {
        role: 'system',
        content: `Available knowledge base: ${JSON.stringify(this.knowledgeBase)}`
      });
    }

    // Add available tools for research
    if (this.loadedTools.length > 0) {
      const researchTools = this.loadedTools.filter(t =>
        ['http_request', 'web_scraper', 'database_query'].includes(t.type)
      );

      if (researchTools.length > 0) {
        const toolsInfo = researchTools.map(t =>
          `- ${t.name}: ${t.description || t.type}`
        ).join('\n');

        basePrompt.messages.splice(1, 0, {
          role: 'system',
          content: `Research tools available:\n${toolsInfo}\n\nUse these tools to gather information from external sources.`
        });
      }
    }

    return basePrompt;
  }

  /**
   * Execute research with automatic tool usage
   * @param {string} query - Research query
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Research results with tool outputs
   */
  async executeResearch(query, context) {
    // Load tools if not loaded
    if (this.loadedTools.length === 0) {
      await this.loadTools();
    }

    // Find relevant tools
    const httpTools = this.loadedTools.filter(t => t.type === 'http_request');
    const scraperTools = this.loadedTools.filter(t => t.type === 'web_scraper');

    const toolResults = [];

    // Execute relevant tools
    for (const tool of [...httpTools, ...scraperTools].slice(0, 3)) {
      try {
        const result = await this.executeTool(tool.name, { query }, context);
        if (result.success) {
          toolResults.push({
            tool: tool.name,
            type: tool.type,
            data: result.result
          });
        }
      } catch (error) {
        log.error(`Research tool ${tool.name} failed:`, { error: error.message, toolName: tool.name });
      }
    }

    return {
      query,
      toolResults,
      toolCount: toolResults.length
    };
  }

  /**
   * Parse research results from output
   * @param {Object} output - Agent output
   * @returns {Object} - Parsed research results
   */
  parseResearchResults(output) {
    try {
      const data = output.type === 'json' ? output.data : JSON.parse(output.raw);
      return {
        valid: true,
        results: data
      };
    } catch {
      return {
        valid: false,
        error: 'Failed to parse research results',
        raw: output.raw
      };
    }
  }
}

module.exports = ResearcherAgent;

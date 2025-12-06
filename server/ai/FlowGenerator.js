const OpenAI = require('openai');
const PromptBuilder = require('./PromptBuilder');
const FlowTemplates = require('./FlowTemplates');
const log = require('../utils/logger');

class FlowGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  }

  /**
   * Generate a complete flow from user description
   * @param {string} prompt - User's description of what the flow should do
   * @param {object} options - Generation options
   * @returns {object} Generated flow structure
   */
  async generateFlow(prompt, options = {}) {
    const {
      templateId = null,
      language = 'en',
      complexity = 'medium',
      includeVariables = true,
      maxNodes = 20
    } = options;

    let baseTemplate = null;
    if (templateId) {
      baseTemplate = FlowTemplates.getTemplateById(templateId);
    }

    const systemPrompt = PromptBuilder.buildFlowPrompt(prompt, {
      baseTemplate,
      language,
      complexity,
      includeVariables,
      maxNodes
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      const flow = JSON.parse(content);

      // Validate and enhance the generated flow
      const validatedFlow = this.validateFlow(flow);

      return {
        success: true,
        flow: validatedFlow,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: this.model,
          prompt: prompt,
          options: options,
          tokensUsed: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      log.error('Flow generation error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        flow: null
      };
    }
  }

  /**
   * Improve an existing flow based on suggestions
   * @param {object} existingFlow - Current flow structure
   * @param {string|array} suggestions - Improvement suggestions
   * @returns {object} Improved flow
   */
  async improveFlow(existingFlow, suggestions) {
    const suggestionsText = Array.isArray(suggestions)
      ? suggestions.join('\n- ')
      : suggestions;

    const systemPrompt = PromptBuilder.buildImprovementPrompt(existingFlow, suggestionsText);

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Current flow:\n${JSON.stringify(existingFlow, null, 2)}\n\nImprovements needed:\n- ${suggestionsText}`
          }
        ],
        temperature: 0.6,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      const improvedFlow = JSON.parse(content);

      return {
        success: true,
        flow: this.validateFlow(improvedFlow),
        changes: this.detectChanges(existingFlow, improvedFlow),
        metadata: {
          improvedAt: new Date().toISOString(),
          suggestions: suggestionsText,
          tokensUsed: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      log.error('Flow improvement error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        flow: existingFlow
      };
    }
  }

  /**
   * Suggest next nodes based on current flow state
   * @param {object} currentFlow - Current flow structure
   * @returns {array} Array of suggested nodes
   */
  async suggestNextNodes(currentFlow) {
    const prompt = `Based on this chatbot flow, suggest 3-5 logical next nodes that would enhance the conversation.

Current flow structure:
${JSON.stringify(currentFlow, null, 2)}

Return a JSON object with:
{
  "suggestions": [
    {
      "nodeType": "type of node",
      "title": "suggested title",
      "description": "why this node would be useful",
      "connectFrom": "which existing node this should connect from",
      "priority": "high/medium/low"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a chatbot flow designer. Analyze flows and suggest improvements.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      const result = JSON.parse(content);

      return {
        success: true,
        suggestions: result.suggestions || [],
        metadata: {
          generatedAt: new Date().toISOString(),
          tokensUsed: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      log.error('Node suggestion error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        suggestions: []
      };
    }
  }

  /**
   * Generate content for a specific node type
   * @param {string} nodeType - Type of node (message, question, condition, etc.)
   * @param {object} context - Context for content generation
   * @returns {object} Generated node content
   */
  async generateNodeContent(nodeType, context = {}) {
    const {
      purpose = '',
      tone = 'professional',
      language = 'en',
      previousMessages = [],
      variables = []
    } = context;

    const nodePrompt = PromptBuilder.buildNodePrompt(nodeType, {
      purpose,
      tone,
      language,
      previousMessages,
      variables
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: nodePrompt },
          {
            role: 'user',
            content: `Generate content for a ${nodeType} node. Purpose: ${purpose}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      const nodeContent = JSON.parse(content);

      return {
        success: true,
        content: nodeContent,
        nodeType: nodeType,
        metadata: {
          generatedAt: new Date().toISOString(),
          context: context,
          tokensUsed: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      log.error('Node content generation error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        content: null
      };
    }
  }

  /**
   * Validate flow structure and fix common issues
   * @param {object} flow - Flow to validate
   * @returns {object} Validated and fixed flow
   */
  validateFlow(flow) {
    if (!flow) {
      return this.getEmptyFlow();
    }

    const validatedFlow = {
      id: flow.id || this.generateId(),
      name: flow.name || 'Untitled Flow',
      description: flow.description || '',
      nodes: [],
      edges: [],
      variables: flow.variables || [],
      settings: {
        startNodeId: null,
        language: flow.settings?.language || 'en',
        timezone: flow.settings?.timezone || 'UTC',
        ...flow.settings
      },
      createdAt: flow.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Validate and normalize nodes
    if (Array.isArray(flow.nodes)) {
      validatedFlow.nodes = flow.nodes.map((node, index) => this.validateNode(node, index));

      // Find start node
      const startNode = validatedFlow.nodes.find(n => n.type === 'start' || n.isStart);
      if (startNode) {
        validatedFlow.settings.startNodeId = startNode.id;
      } else if (validatedFlow.nodes.length > 0) {
        validatedFlow.settings.startNodeId = validatedFlow.nodes[0].id;
      }
    }

    // Validate and normalize edges
    if (Array.isArray(flow.edges)) {
      const nodeIds = new Set(validatedFlow.nodes.map(n => n.id));
      validatedFlow.edges = flow.edges
        .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .map((edge, index) => this.validateEdge(edge, index));
    }

    return validatedFlow;
  }

  /**
   * Validate a single node
   */
  validateNode(node, index) {
    const validTypes = [
      'start', 'message', 'question', 'condition', 'action',
      'api_call', 'set_variable', 'delay', 'end', 'goto',
      'email', 'webhook', 'ai_response', 'menu', 'input'
    ];

    return {
      id: node.id || `node_${index}_${this.generateId()}`,
      type: validTypes.includes(node.type) ? node.type : 'message',
      position: {
        x: node.position?.x || index * 200,
        y: node.position?.y || index * 100
      },
      data: {
        label: node.data?.label || node.label || `Node ${index + 1}`,
        content: node.data?.content || node.content || '',
        ...node.data
      },
      isStart: node.type === 'start' || node.isStart || false
    };
  }

  /**
   * Validate a single edge
   */
  validateEdge(edge, index) {
    return {
      id: edge.id || `edge_${index}_${this.generateId()}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      label: edge.label || '',
      condition: edge.condition || null
    };
  }

  /**
   * Detect changes between two flows
   */
  detectChanges(oldFlow, newFlow) {
    const changes = {
      nodesAdded: [],
      nodesRemoved: [],
      nodesModified: [],
      edgesAdded: [],
      edgesRemoved: []
    };

    const oldNodeIds = new Set((oldFlow.nodes || []).map(n => n.id));
    const newNodeIds = new Set((newFlow.nodes || []).map(n => n.id));

    // Find added and removed nodes
    for (const node of (newFlow.nodes || [])) {
      if (!oldNodeIds.has(node.id)) {
        changes.nodesAdded.push(node);
      }
    }

    for (const node of (oldFlow.nodes || [])) {
      if (!newNodeIds.has(node.id)) {
        changes.nodesRemoved.push(node);
      }
    }

    // Find modified nodes
    for (const newNode of (newFlow.nodes || [])) {
      const oldNode = (oldFlow.nodes || []).find(n => n.id === newNode.id);
      if (oldNode && JSON.stringify(oldNode) !== JSON.stringify(newNode)) {
        changes.nodesModified.push({ old: oldNode, new: newNode });
      }
    }

    // Similar logic for edges
    const oldEdgeKeys = new Set((oldFlow.edges || []).map(e => `${e.source}-${e.target}`));
    const newEdgeKeys = new Set((newFlow.edges || []).map(e => `${e.source}-${e.target}`));

    for (const edge of (newFlow.edges || [])) {
      const key = `${edge.source}-${edge.target}`;
      if (!oldEdgeKeys.has(key)) {
        changes.edgesAdded.push(edge);
      }
    }

    for (const edge of (oldFlow.edges || [])) {
      const key = `${edge.source}-${edge.target}`;
      if (!newEdgeKeys.has(key)) {
        changes.edgesRemoved.push(edge);
      }
    }

    return changes;
  }

  /**
   * Get an empty flow structure
   */
  getEmptyFlow() {
    const startNodeId = this.generateId();
    return {
      id: this.generateId(),
      name: 'New Flow',
      description: '',
      nodes: [
        {
          id: startNodeId,
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start', content: '' },
          isStart: true
        }
      ],
      edges: [],
      variables: [],
      settings: {
        startNodeId: startNodeId,
        language: 'en',
        timezone: 'UTC'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new FlowGenerator();

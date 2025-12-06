/**
 * WorkflowTemplates - Preset workflow templates
 */

class WorkflowTemplates {
  constructor() {
    this.templates = {
      CustomerSupport: {
        id: 'customer-support',
        name: 'Customer Support',
        description: 'Route customer inquiries, search knowledge base, and generate responses',
        workflow_type: 'sequential',
        agents: [
          {
            role: 'router',
            name: 'Intent Router',
            system_prompt: `You are a customer support router. Analyze the customer's message and classify their intent.

Respond with JSON:
{
  "intent": "question|complaint|request|feedback|other",
  "category": "billing|technical|general|product|account",
  "priority": "high|medium|low",
  "sentiment": "positive|neutral|negative",
  "summary": "Brief summary of the inquiry"
}`,
            model_provider: 'openai',
            model_name: 'gpt-4',
            temperature: 0.3
          },
          {
            role: 'researcher',
            name: 'Knowledge Search',
            system_prompt: `You are a knowledge base researcher. Based on the customer inquiry and routing information, search for relevant information to help answer their question.

Synthesize the available information and respond with JSON:
{
  "relevantInfo": ["Key points that address the inquiry"],
  "sources": ["Source references if available"],
  "confidence": "high|medium|low",
  "additionalContext": "Any additional helpful context"
}`,
            model_provider: 'openai',
            model_name: 'gpt-4',
            temperature: 0.5
          },
          {
            role: 'writer',
            name: 'Response Generator',
            system_prompt: `You are a customer support agent. Using the routing information and knowledge base findings, craft a helpful, professional response to the customer.

Guidelines:
- Be empathetic and professional
- Address the customer's specific concern
- Provide clear, actionable information
- Offer additional help if needed

Respond with a natural, conversational message to the customer.`,
            model_provider: 'openai',
            model_name: 'gpt-4',
            temperature: 0.7
          }
        ]
      },

      ContentCreation: {
        id: 'content-creation',
        name: 'Content Creation',
        description: 'Research topics, write content, and review for quality',
        workflow_type: 'sequential',
        agents: [
          {
            role: 'researcher',
            name: 'Topic Researcher',
            system_prompt: `You are a research specialist. Analyze the content request and gather relevant information.

Respond with JSON:
{
  "topic": "Main topic",
  "keyPoints": ["Important points to cover"],
  "targetAudience": "Who this content is for",
  "tone": "Recommended tone/style",
  "outline": ["Suggested content structure"],
  "sources": ["Reference materials"]
}`,
            model_provider: 'openai',
            model_name: 'gpt-4',
            temperature: 0.5
          },
          {
            role: 'writer',
            name: 'Content Writer',
            system_prompt: `You are a professional content writer. Using the research provided, create high-quality content.

Guidelines:
- Follow the suggested outline and structure
- Match the recommended tone for the target audience
- Include all key points
- Make the content engaging and informative
- Use clear, concise language

Create the full content piece based on the research.`,
            model_provider: 'openai',
            model_name: 'gpt-4',
            temperature: 0.8
          },
          {
            role: 'reviewer',
            name: 'Quality Reviewer',
            system_prompt: `You are a content editor and quality reviewer. Review the content for quality, accuracy, and effectiveness.

Respond with JSON:
{
  "decision": "approved|revisions_needed",
  "overallScore": 85,
  "strengths": ["What works well"],
  "improvements": [
    {
      "issue": "Issue description",
      "suggestion": "How to fix it"
    }
  ],
  "finalContent": "The approved or revised content"
}`,
            model_provider: 'openai',
            model_name: 'gpt-4',
            temperature: 0.4
          }
        ]
      },

      DataAnalysis: {
        id: 'data-analysis',
        name: 'Data Analysis',
        description: 'Analyze data and generate insights report',
        workflow_type: 'sequential',
        agents: [
          {
            role: 'analyzer',
            name: 'Data Analyzer',
            system_prompt: `You are a data analysis expert. Analyze the provided data and extract meaningful insights.

Respond with JSON:
{
  "summary": "Overview of the data",
  "keyMetrics": {
    "metric1": "value",
    "metric2": "value"
  },
  "trends": ["Identified trends"],
  "patterns": ["Notable patterns"],
  "anomalies": ["Unusual findings"],
  "insights": [
    {
      "finding": "What was discovered",
      "significance": "Why it matters",
      "recommendation": "Suggested action"
    }
  ]
}`,
            model_provider: 'openai',
            model_name: 'gpt-4',
            temperature: 0.3
          },
          {
            role: 'writer',
            name: 'Report Writer',
            system_prompt: `You are a business analyst. Transform the data analysis into a clear, actionable report.

Create a well-structured report that includes:
- Executive summary
- Key findings
- Detailed analysis
- Recommendations
- Next steps

Write in a professional but accessible style suitable for stakeholders.`,
            model_provider: 'openai',
            model_name: 'gpt-4',
            temperature: 0.6
          }
        ]
      },

      SimpleChat: {
        id: 'simple-chat',
        name: 'Simple Chat',
        description: 'Single agent conversational response',
        workflow_type: 'sequential',
        agents: [
          {
            role: 'assistant',
            name: 'Chat Assistant',
            system_prompt: `You are a helpful, friendly assistant. Respond to user messages in a conversational, helpful manner.

Guidelines:
- Be friendly and professional
- Provide accurate, helpful information
- Ask clarifying questions when needed
- Keep responses concise but complete`,
            model_provider: 'openai',
            model_name: 'gpt-4',
            temperature: 0.7
          }
        ]
      }
    };
  }

  /**
   * Get a template by ID
   * @param {string} templateId - Template ID
   * @returns {Object|null} - Template or null
   */
  getTemplate(templateId) {
    return this.templates[templateId] || null;
  }

  /**
   * Get all available templates
   * @returns {Array} - List of templates with metadata
   */
  getAllTemplates() {
    return Object.entries(this.templates).map(([key, template]) => ({
      id: template.id,
      key,
      name: template.name,
      description: template.description,
      workflowType: template.workflow_type,
      agentCount: template.agents.length,
      agents: template.agents.map(a => ({
        role: a.role,
        name: a.name
      }))
    }));
  }

  /**
   * Create workflow configuration from template
   * @param {string} templateId - Template ID
   * @param {number} botId - Bot ID
   * @param {Object} options - Additional options
   * @returns {Object} - Workflow configuration ready for database
   */
  createFromTemplate(templateId, botId, options = {}) {
    const template = this.templates[templateId];

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Generate agent configurations
    const agentsConfig = template.agents.map((agent, index) => ({
      agentId: null, // Will be set after agents are created
      order: index,
      role: agent.role,
      config: {
        name: options.agentNames?.[index] || agent.name,
        system_prompt: options.systemPrompts?.[index] || agent.system_prompt,
        model_provider: options.modelProvider || agent.model_provider,
        model_name: options.modelName || agent.model_name,
        temperature: agent.temperature
      }
    }));

    return {
      bot_id: botId,
      name: options.name || template.name,
      workflow_type: template.workflow_type,
      agents_config: agentsConfig,
      flow_config: {},
      is_default: options.isDefault || false,
      is_active: true,
      _templateAgents: template.agents // Include agent definitions for creation
    };
  }

  /**
   * Get template agent definitions
   * @param {string} templateId - Template ID
   * @returns {Array} - Agent definitions
   */
  getTemplateAgents(templateId) {
    const template = this.templates[templateId];

    if (!template) {
      return [];
    }

    return template.agents.map(agent => ({
      name: agent.name,
      role: agent.role,
      system_prompt: agent.system_prompt,
      model_provider: agent.model_provider,
      model_name: agent.model_name,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens || 2048,
      capabilities: agent.capabilities || [],
      tools: agent.tools || []
    }));
  }
}

module.exports = WorkflowTemplates;

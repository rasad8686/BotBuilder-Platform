/**
 * RouterAgent - Intent detection and routing
 */

const Agent = require('../core/Agent');

class RouterAgent extends Agent {
  constructor(config) {
    super({
      ...config,
      role: config.role || 'router',
      systemPrompt: config.systemPrompt || `You are a routing agent specialized in intent detection and request classification.

Your responsibilities:
1. Analyze user input to detect intent
2. Classify requests into predefined categories
3. Extract key entities and parameters
4. Route to the appropriate workflow or agent
5. Handle ambiguous inputs by asking for clarification

When routing, respond with a JSON object:
{
  "intent": {
    "primary": "main_intent",
    "secondary": ["other_possible_intents"],
    "confidence": 0.95
  },
  "category": "category_name",
  "entities": [
    {
      "type": "entity_type",
      "value": "extracted_value",
      "confidence": 0.9
    }
  ],
  "routing": {
    "targetAgent": "agent_id_or_role",
    "targetWorkflow": "workflow_id",
    "priority": "high|normal|low"
  },
  "parameters": {
    "key": "value"
  },
  "requiresClarification": false,
  "clarificationQuestion": null,
  "sentiment": "positive|neutral|negative",
  "language": "en"
}`
    });

    this.routes = config.routes || [];
    this.defaultRoute = config.defaultRoute || null;
  }

  /**
   * Set available routes
   * @param {Array} routes - Available routes
   */
  setRoutes(routes) {
    this.routes = routes;
  }

  /**
   * Set default route
   * @param {Object} route - Default route when no match
   */
  setDefaultRoute(route) {
    this.defaultRoute = route;
  }

  /**
   * Build prompt with routing context
   */
  buildPrompt(input, context) {
    const basePrompt = super.buildPrompt(input, context);

    if (this.routes.length > 0) {
      const routesInfo = this.routes.map(r =>
        `- ${r.intent || r.category}: Route to ${r.target} (${r.description || ''})`
      ).join('\n');

      basePrompt.messages.splice(1, 0, {
        role: 'system',
        content: `Available routes:\n${routesInfo}\n\nDefault route: ${this.defaultRoute?.target || 'none'}`
      });
    }

    return basePrompt;
  }

  /**
   * Parse routing decision from output
   * @param {Object} output - Agent output
   * @returns {Object} - Parsed routing decision
   */
  parseRouting(output) {
    try {
      const data = output.type === 'json' ? output.data : JSON.parse(output.raw);
      return {
        valid: true,
        routing: data
      };
    } catch {
      return {
        valid: false,
        error: 'Failed to parse routing decision',
        raw: output.raw
      };
    }
  }

  /**
   * Get the target from routing decision
   * @param {Object} routing - Parsed routing decision
   * @returns {Object} - Target information
   */
  getTarget(routing) {
    if (routing.routing) {
      return {
        agent: routing.routing.targetAgent,
        workflow: routing.routing.targetWorkflow,
        priority: routing.routing.priority || 'normal'
      };
    }

    // Use default route if available
    if (this.defaultRoute) {
      return {
        agent: this.defaultRoute.agent,
        workflow: this.defaultRoute.workflow,
        priority: 'normal'
      };
    }

    return null;
  }

  /**
   * Check if clarification is needed
   * @param {Object} routing - Parsed routing decision
   * @returns {boolean} - Whether clarification is needed
   */
  needsClarification(routing) {
    return routing.requiresClarification === true;
  }

  /**
   * Get clarification question
   * @param {Object} routing - Parsed routing decision
   * @returns {string|null} - Clarification question
   */
  getClarificationQuestion(routing) {
    return routing.clarificationQuestion || null;
  }
}

module.exports = RouterAgent;

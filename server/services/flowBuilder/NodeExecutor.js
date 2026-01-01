const log = require('../../utils/logger');

/**
 * NodeExecutor - Executes individual nodes based on their type
 * Handles all node type-specific logic and operations
 */
class NodeExecutor {
  constructor() {
    this.nodeHandlers = {
      start: this.executeStartNode.bind(this),
      message: this.executeMessageNode.bind(this),
      question: this.executeQuestionNode.bind(this),
      menu: this.executeMenuNode.bind(this),
      input: this.executeInputNode.bind(this),
      condition: this.executeConditionNode.bind(this),
      action: this.executeActionNode.bind(this),
      api_call: this.executeApiCallNode.bind(this),
      set_variable: this.executeSetVariableNode.bind(this),
      delay: this.executeDelayNode.bind(this),
      email: this.executeEmailNode.bind(this),
      webhook: this.executeWebhookNode.bind(this),
      ai_response: this.executeAiResponseNode.bind(this),
      goto: this.executeGotoNode.bind(this),
      end: this.executeEndNode.bind(this)
    };
  }

  /**
   * Execute a node based on its type
   * @param {object} node - Node to execute
   * @param {object} executionState - Current execution state
   * @returns {Promise<object>} Execution result
   */
  async execute(node, executionState) {
    if (!node || !node.type) {
      throw new Error('Invalid node: missing type');
    }

    const handler = this.nodeHandlers[node.type];
    if (!handler) {
      throw new Error(`No handler for node type: ${node.type}`);
    }

    try {
      const result = await handler(node, executionState);
      return {
        success: true,
        nodeId: node.id,
        nodeType: node.type,
        ...result
      };
    } catch (error) {
      log.error(`Error executing ${node.type} node:`, { error: error.message });
      return {
        success: false,
        error: error.message,
        nodeId: node.id,
        nodeType: node.type
      };
    }
  }

  /**
   * Execute start node
   */
  async executeStartNode(node, executionState) {
    return {
      output: null,
      waitForInput: false
    };
  }

  /**
   * Execute message node
   */
  async executeMessageNode(node, executionState) {
    const content = this.substituteVariables(
      node.data.content || node.data.label || '',
      executionState.variables
    );

    return {
      output: {
        type: 'message',
        content: content
      },
      waitForInput: false
    };
  }

  /**
   * Execute question node
   */
  async executeQuestionNode(node, executionState) {
    const content = this.substituteVariables(
      node.data.content || '',
      executionState.variables
    );

    // Check if we already have an answer from user input
    if (executionState.context.userResponse) {
      const selectedOption = executionState.context.userResponse;
      const variableName = node.data.variableName || 'last_response';

      return {
        output: {
          type: 'question_answered',
          question: content,
          answer: selectedOption
        },
        selectedOption: selectedOption,
        variables: {
          [variableName]: selectedOption
        },
        waitForInput: false
      };
    }

    // Need to wait for user input
    return {
      output: {
        type: 'question',
        content: content,
        options: node.data.options || []
      },
      waitForInput: true,
      message: 'Waiting for user to select an option'
    };
  }

  /**
   * Execute menu node (similar to question)
   */
  async executeMenuNode(node, executionState) {
    const content = this.substituteVariables(
      node.data.content || '',
      executionState.variables
    );

    // Check if we already have a selection
    if (executionState.context.userResponse) {
      const selectedOption = executionState.context.userResponse;
      const variableName = node.data.variableName || 'menu_selection';

      return {
        output: {
          type: 'menu_selected',
          content: content,
          selection: selectedOption
        },
        selectedOption: selectedOption,
        variables: {
          [variableName]: selectedOption
        },
        waitForInput: false
      };
    }

    return {
      output: {
        type: 'menu',
        content: content,
        options: node.data.options || []
      },
      waitForInput: true,
      message: 'Waiting for menu selection'
    };
  }

  /**
   * Execute input node
   */
  async executeInputNode(node, executionState) {
    const content = this.substituteVariables(
      node.data.content || '',
      executionState.variables
    );

    const variableName = node.data.variableName;
    if (!variableName) {
      throw new Error('Input node must specify variableName');
    }

    // Check if we have user input
    if (executionState.context.userInput !== undefined) {
      const userInput = executionState.context.userInput;

      // Validate input if validation is specified
      if (node.data.validation) {
        const isValid = this.validateInput(userInput, node.data.validation);
        if (!isValid) {
          return {
            output: {
              type: 'validation_error',
              message: `Invalid input for ${node.data.validation}`,
              content: content
            },
            waitForInput: true,
            error: `Validation failed for ${node.data.validation}`
          };
        }
      }

      return {
        output: {
          type: 'input_received',
          variableName: variableName,
          value: userInput
        },
        variables: {
          [variableName]: userInput
        },
        waitForInput: false
      };
    }

    // Need user input
    return {
      output: {
        type: 'input',
        content: content,
        variableName: variableName,
        inputType: node.data.inputType || 'text',
        validation: node.data.validation
      },
      waitForInput: true,
      message: 'Waiting for user input'
    };
  }

  /**
   * Execute condition node
   */
  async executeConditionNode(node, executionState) {
    const conditions = node.data.conditions || [];

    for (const condition of conditions) {
      const result = this.evaluateCondition(
        condition,
        executionState.variables
      );

      if (result) {
        return {
          output: {
            type: 'condition_evaluated',
            matched: condition.label || condition.id,
            condition: condition
          },
          selectedOption: condition.label || condition.id,
          waitForInput: false
        };
      }
    }

    // No condition matched
    return {
      output: {
        type: 'condition_evaluated',
        matched: 'default',
        condition: null
      },
      selectedOption: 'default',
      waitForInput: false
    };
  }

  /**
   * Execute action node
   */
  async executeActionNode(node, executionState) {
    const actionType = node.data.actionType || 'generic';
    const content = this.substituteVariables(
      node.data.content || '',
      executionState.variables
    );

    // Different actions would be handled differently
    // For now, we just log and continue
    log.info(`Executing action: ${actionType}`);

    return {
      output: {
        type: 'action',
        actionType: actionType,
        content: content,
        executed: true
      },
      waitForInput: false
    };
  }

  /**
   * Execute API call node
   */
  async executeApiCallNode(node, executionState) {
    const endpoint = this.substituteVariables(
      node.data.endpoint || '',
      executionState.variables
    );

    const method = node.data.method || 'GET';
    const headers = node.data.headers || {};
    const body = node.data.body ? this.substituteVariables(
      JSON.stringify(node.data.body),
      executionState.variables
    ) : null;

    // In a real implementation, this would make an actual API call
    // For now, we simulate a successful response
    const responseVariableName = node.data.responseVariable || 'api_response';

    return {
      output: {
        type: 'api_call',
        endpoint: endpoint,
        method: method,
        status: 'simulated'
      },
      variables: {
        [responseVariableName]: {
          status: 200,
          data: { success: true }
        }
      },
      waitForInput: false
    };
  }

  /**
   * Execute set variable node
   */
  async executeSetVariableNode(node, executionState) {
    const variableName = node.data.variableName;
    if (!variableName) {
      throw new Error('Set variable node must specify variableName');
    }

    let value = node.data.value;

    // Substitute variables in the value if it's a string
    if (typeof value === 'string') {
      value = this.substituteVariables(value, executionState.variables);
    }

    // Evaluate expression if specified
    if (node.data.expression) {
      value = this.evaluateExpression(
        node.data.expression,
        executionState.variables
      );
    }

    return {
      output: {
        type: 'variable_set',
        variableName: variableName,
        value: value
      },
      variables: {
        [variableName]: value
      },
      waitForInput: false
    };
  }

  /**
   * Execute delay node
   */
  async executeDelayNode(node, executionState) {
    const duration = node.data.duration || 1000; // milliseconds

    // In a real implementation, this would actually delay
    // For testing, we just record that a delay occurred
    return {
      output: {
        type: 'delay',
        duration: duration,
        message: `Delayed for ${duration}ms`
      },
      waitForInput: false
    };
  }

  /**
   * Execute email node
   */
  async executeEmailNode(node, executionState) {
    const to = this.substituteVariables(
      node.data.to || '',
      executionState.variables
    );

    const subject = this.substituteVariables(
      node.data.subject || '',
      executionState.variables
    );

    const content = this.substituteVariables(
      node.data.content || '',
      executionState.variables
    );

    // In a real implementation, this would send an email
    return {
      output: {
        type: 'email',
        to: to,
        subject: subject,
        sent: true
      },
      waitForInput: false
    };
  }

  /**
   * Execute webhook node
   */
  async executeWebhookNode(node, executionState) {
    const url = this.substituteVariables(
      node.data.url || '',
      executionState.variables
    );

    const method = node.data.method || 'POST';
    const payload = node.data.payload ? this.substituteVariables(
      JSON.stringify(node.data.payload),
      executionState.variables
    ) : null;

    // In a real implementation, this would call the webhook
    return {
      output: {
        type: 'webhook',
        url: url,
        method: method,
        status: 'simulated'
      },
      waitForInput: false
    };
  }

  /**
   * Execute AI response node
   */
  async executeAiResponseNode(node, executionState) {
    const prompt = this.substituteVariables(
      node.data.content || node.data.prompt || '',
      executionState.variables
    );

    // In a real implementation, this would call an AI service
    const aiResponse = `AI response to: ${prompt}`;

    const responseVariable = node.data.responseVariable || 'ai_response';

    return {
      output: {
        type: 'ai_response',
        content: aiResponse
      },
      variables: {
        [responseVariable]: aiResponse
      },
      waitForInput: false
    };
  }

  /**
   * Execute goto node
   */
  async executeGotoNode(node, executionState) {
    const targetNodeId = node.data.targetNodeId;
    if (!targetNodeId) {
      throw new Error('Goto node must specify targetNodeId');
    }

    return {
      output: {
        type: 'goto',
        targetNodeId: targetNodeId
      },
      nextNodeId: targetNodeId,
      waitForInput: false
    };
  }

  /**
   * Execute end node
   */
  async executeEndNode(node, executionState) {
    const content = this.substituteVariables(
      node.data.content || 'Flow completed',
      executionState.variables
    );

    return {
      output: {
        type: 'end',
        content: content
      },
      waitForInput: false
    };
  }

  /**
   * Substitute variables in a string
   * Supports {{variable}} syntax
   * @param {string} text - Text with variables
   * @param {object} variables - Variable values
   * @returns {string} Text with substituted variables
   */
  substituteVariables(text, variables) {
    if (typeof text !== 'string') {
      return text;
    }

    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedVarName = varName.trim();
      return variables[trimmedVarName] !== undefined
        ? variables[trimmedVarName]
        : match;
    });
  }

  /**
   * Validate input based on validation type
   * @param {*} input - Input to validate
   * @param {string} validationType - Type of validation
   * @returns {boolean} True if valid
   */
  validateInput(input, validationType) {
    const inputStr = String(input);

    switch (validationType) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputStr);

      case 'phone':
        return /^[\d\s\-\+\(\)]+$/.test(inputStr) && inputStr.replace(/\D/g, '').length >= 10;

      case 'url':
        try {
          new URL(inputStr);
          return true;
        } catch {
          return false;
        }

      case 'number':
        return !isNaN(Number(inputStr));

      case 'date':
        return !isNaN(Date.parse(inputStr));

      case 'time':
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(inputStr);

      default:
        return true; // No validation or unknown type
    }
  }

  /**
   * Evaluate a condition
   * @param {object} condition - Condition to evaluate
   * @param {object} variables - Current variables
   * @returns {boolean} Evaluation result
   */
  evaluateCondition(condition, variables) {
    const { variable, operator, value } = condition;
    const varValue = variables[variable];

    switch (operator) {
      case 'equals':
      case 'eq':
        return varValue == value;

      case 'not_equals':
      case 'ne':
        return varValue != value;

      case 'greater_than':
      case 'gt':
        return Number(varValue) > Number(value);

      case 'greater_than_equals':
      case 'gte':
        return Number(varValue) >= Number(value);

      case 'less_than':
      case 'lt':
        return Number(varValue) < Number(value);

      case 'less_than_equals':
      case 'lte':
        return Number(varValue) <= Number(value);

      case 'contains':
        return String(varValue).includes(String(value));

      case 'not_contains':
        return !String(varValue).includes(String(value));

      case 'starts_with':
        return String(varValue).startsWith(String(value));

      case 'ends_with':
        return String(varValue).endsWith(String(value));

      case 'is_empty':
        return !varValue || varValue === '';

      case 'is_not_empty':
        return !!varValue && varValue !== '';

      default:
        return false;
    }
  }

  /**
   * Evaluate a simple expression
   * @param {string} expression - Expression to evaluate
   * @param {object} variables - Current variables
   * @returns {*} Evaluation result
   */
  evaluateExpression(expression, variables) {
    // Simple expression evaluation
    // In a real implementation, this would be more sophisticated
    // For now, just substitute variables and try to evaluate basic math
    const substituted = this.substituteVariables(expression, variables);

    try {
      // Only allow safe math operations
      if (/^[\d\s\+\-\*\/\(\)\.]+$/.test(substituted)) {
        return eval(substituted);
      }
      return substituted;
    } catch {
      return substituted;
    }
  }
}

module.exports = NodeExecutor;

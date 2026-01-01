const NodeExecutor = require('../../../services/flowBuilder/NodeExecutor');

jest.mock('../../../utils/logger');

describe('NodeExecutor', () => {
  let executor;

  beforeEach(() => {
    executor = new NodeExecutor();
  });

  describe('execute', () => {
    it('should execute a node successfully', async () => {
      const node = {
        id: 'msg_1',
        type: 'message',
        data: { content: 'Hello' }
      };

      const executionState = { variables: {} };
      const result = await executor.execute(node, executionState);

      expect(result.success).toBe(true);
      expect(result.nodeId).toBe('msg_1');
      expect(result.nodeType).toBe('message');
    });

    it('should fail for invalid node without type', async () => {
      const node = { id: 'node_1', data: {} };
      const executionState = { variables: {} };

      await expect(executor.execute(node, executionState)).rejects.toThrow('Invalid node: missing type');
    });

    it('should fail for unsupported node type', async () => {
      const node = {
        id: 'node_1',
        type: 'unsupported_type',
        data: {}
      };

      const executionState = { variables: {} };

      await expect(executor.execute(node, executionState)).rejects.toThrow('No handler for node type: unsupported_type');
    });

    it('should handle execution errors gracefully', async () => {
      const node = {
        id: 'input_1',
        type: 'input',
        data: {} // Missing required variableName
      };

      const executionState = { variables: {}, context: {} };
      const result = await executor.execute(node, executionState);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('executeStartNode', () => {
    it('should execute start node', async () => {
      const node = {
        id: 'start_1',
        type: 'start',
        data: { label: 'Start' }
      };

      const executionState = { variables: {} };
      const result = await executor.executeStartNode(node, executionState);

      expect(result.output).toBeNull();
      expect(result.waitForInput).toBe(false);
    });
  });

  describe('executeMessageNode', () => {
    it('should execute message node with content', async () => {
      const node = {
        id: 'msg_1',
        type: 'message',
        data: { content: 'Hello World' }
      };

      const executionState = { variables: {} };
      const result = await executor.executeMessageNode(node, executionState);

      expect(result.output.type).toBe('message');
      expect(result.output.content).toBe('Hello World');
      expect(result.waitForInput).toBe(false);
    });

    it('should substitute variables in message content', async () => {
      const node = {
        id: 'msg_1',
        type: 'message',
        data: { content: 'Hello {{name}}!' }
      };

      const executionState = { variables: { name: 'John' } };
      const result = await executor.executeMessageNode(node, executionState);

      expect(result.output.content).toBe('Hello John!');
    });

    it('should use label if content is missing', async () => {
      const node = {
        id: 'msg_1',
        type: 'message',
        data: { label: 'Test Message' }
      };

      const executionState = { variables: {} };
      const result = await executor.executeMessageNode(node, executionState);

      expect(result.output.content).toBe('Test Message');
    });
  });

  describe('executeQuestionNode', () => {
    it('should present question and wait for input', async () => {
      const node = {
        id: 'q_1',
        type: 'question',
        data: {
          content: 'Choose an option',
          options: ['Yes', 'No']
        }
      };

      const executionState = { variables: {}, context: {} };
      const result = await executor.executeQuestionNode(node, executionState);

      expect(result.output.type).toBe('question');
      expect(result.output.content).toBe('Choose an option');
      expect(result.output.options).toEqual(['Yes', 'No']);
      expect(result.waitForInput).toBe(true);
    });

    it('should process user response', async () => {
      const node = {
        id: 'q_1',
        type: 'question',
        data: {
          content: 'Continue?',
          options: ['Yes', 'No'],
          variableName: 'user_choice'
        }
      };

      const executionState = {
        variables: {},
        context: { userResponse: 'Yes' }
      };

      const result = await executor.executeQuestionNode(node, executionState);

      expect(result.output.type).toBe('question_answered');
      expect(result.selectedOption).toBe('Yes');
      expect(result.variables.user_choice).toBe('Yes');
      expect(result.waitForInput).toBe(false);
    });

    it('should use default variable name if not specified', async () => {
      const node = {
        id: 'q_1',
        type: 'question',
        data: {
          content: 'Continue?',
          options: ['Yes', 'No']
        }
      };

      const executionState = {
        variables: {},
        context: { userResponse: 'Yes' }
      };

      const result = await executor.executeQuestionNode(node, executionState);

      expect(result.variables.last_response).toBe('Yes');
    });
  });

  describe('executeMenuNode', () => {
    it('should present menu and wait for selection', async () => {
      const node = {
        id: 'menu_1',
        type: 'menu',
        data: {
          content: 'Select service',
          options: [
            { label: 'Support', value: 'support' },
            { label: 'Sales', value: 'sales' }
          ]
        }
      };

      const executionState = { variables: {}, context: {} };
      const result = await executor.executeMenuNode(node, executionState);

      expect(result.output.type).toBe('menu');
      expect(result.waitForInput).toBe(true);
    });

    it('should process menu selection', async () => {
      const node = {
        id: 'menu_1',
        type: 'menu',
        data: {
          content: 'Select service',
          options: [{ label: 'Support', value: 'support' }],
          variableName: 'selected_service'
        }
      };

      const executionState = {
        variables: {},
        context: { userResponse: 'support' }
      };

      const result = await executor.executeMenuNode(node, executionState);

      expect(result.output.type).toBe('menu_selected');
      expect(result.selectedOption).toBe('support');
      expect(result.variables.selected_service).toBe('support');
    });
  });

  describe('executeInputNode', () => {
    it('should request user input', async () => {
      const node = {
        id: 'input_1',
        type: 'input',
        data: {
          content: 'Enter your name',
          variableName: 'user_name'
        }
      };

      const executionState = { variables: {}, context: {} };
      const result = await executor.executeInputNode(node, executionState);

      expect(result.output.type).toBe('input');
      expect(result.output.variableName).toBe('user_name');
      expect(result.waitForInput).toBe(true);
    });

    it('should process user input', async () => {
      const node = {
        id: 'input_1',
        type: 'input',
        data: {
          content: 'Enter your name',
          variableName: 'user_name'
        }
      };

      const executionState = {
        variables: {},
        context: { userInput: 'Alice' }
      };

      const result = await executor.executeInputNode(node, executionState);

      expect(result.output.type).toBe('input_received');
      expect(result.variables.user_name).toBe('Alice');
      expect(result.waitForInput).toBe(false);
    });

    it('should validate email input', async () => {
      const node = {
        id: 'input_1',
        type: 'input',
        data: {
          content: 'Enter email',
          variableName: 'email',
          validation: 'email'
        }
      };

      const executionState = {
        variables: {},
        context: { userInput: 'invalid-email' }
      };

      const result = await executor.executeInputNode(node, executionState);

      expect(result.output.type).toBe('validation_error');
      expect(result.waitForInput).toBe(true);
    });

    it('should accept valid email', async () => {
      const node = {
        id: 'input_1',
        type: 'input',
        data: {
          content: 'Enter email',
          variableName: 'email',
          validation: 'email'
        }
      };

      const executionState = {
        variables: {},
        context: { userInput: 'user@example.com' }
      };

      const result = await executor.executeInputNode(node, executionState);

      expect(result.output.type).toBe('input_received');
      expect(result.variables.email).toBe('user@example.com');
    });

    it('should throw error if variableName is missing', async () => {
      const node = {
        id: 'input_1',
        type: 'input',
        data: { content: 'Enter value' }
      };

      const executionState = { variables: {}, context: {} };

      await expect(executor.executeInputNode(node, executionState)).rejects.toThrow('must specify variableName');
    });
  });

  describe('executeConditionNode', () => {
    it('should evaluate conditions and return matched condition', async () => {
      const node = {
        id: 'cond_1',
        type: 'condition',
        data: {
          conditions: [
            { id: 'c1', variable: 'age', operator: 'gte', value: '18', label: 'adult' },
            { id: 'c2', variable: 'age', operator: 'lt', value: '18', label: 'minor' }
          ]
        }
      };

      const executionState = { variables: { age: 25 } };
      const result = await executor.executeConditionNode(node, executionState);

      expect(result.output.type).toBe('condition_evaluated');
      expect(result.selectedOption).toBe('adult');
    });

    it('should return default when no condition matches', async () => {
      const node = {
        id: 'cond_1',
        type: 'condition',
        data: {
          conditions: [
            { id: 'c1', variable: 'status', operator: 'eq', value: 'active', label: 'is_active' }
          ]
        }
      };

      const executionState = { variables: { status: 'inactive' } };
      const result = await executor.executeConditionNode(node, executionState);

      expect(result.selectedOption).toBe('default');
    });

    it('should handle empty conditions array', async () => {
      const node = {
        id: 'cond_1',
        type: 'condition',
        data: { conditions: [] }
      };

      const executionState = { variables: {} };
      const result = await executor.executeConditionNode(node, executionState);

      expect(result.selectedOption).toBe('default');
    });
  });

  describe('executeActionNode', () => {
    it('should execute action node', async () => {
      const node = {
        id: 'action_1',
        type: 'action',
        data: {
          actionType: 'handoff',
          content: 'Connecting to agent...'
        }
      };

      const executionState = { variables: {} };
      const result = await executor.executeActionNode(node, executionState);

      expect(result.output.type).toBe('action');
      expect(result.output.actionType).toBe('handoff');
      expect(result.output.executed).toBe(true);
      expect(result.waitForInput).toBe(false);
    });

    it('should substitute variables in action content', async () => {
      const node = {
        id: 'action_1',
        type: 'action',
        data: {
          actionType: 'notify',
          content: 'Notifying {{admin_name}}'
        }
      };

      const executionState = { variables: { admin_name: 'Bob' } };
      const result = await executor.executeActionNode(node, executionState);

      expect(result.output.content).toBe('Notifying Bob');
    });
  });

  describe('executeApiCallNode', () => {
    it('should execute API call node', async () => {
      const node = {
        id: 'api_1',
        type: 'api_call',
        data: {
          endpoint: '/api/users',
          method: 'GET',
          responseVariable: 'api_result'
        }
      };

      const executionState = { variables: {} };
      const result = await executor.executeApiCallNode(node, executionState);

      expect(result.output.type).toBe('api_call');
      expect(result.output.endpoint).toBe('/api/users');
      expect(result.output.method).toBe('GET');
      expect(result.variables.api_result).toBeDefined();
    });

    it('should substitute variables in endpoint', async () => {
      const node = {
        id: 'api_1',
        type: 'api_call',
        data: {
          endpoint: '/api/users/{{user_id}}',
          method: 'GET'
        }
      };

      const executionState = { variables: { user_id: '123' } };
      const result = await executor.executeApiCallNode(node, executionState);

      expect(result.output.endpoint).toBe('/api/users/123');
    });

    it('should use default response variable name', async () => {
      const node = {
        id: 'api_1',
        type: 'api_call',
        data: {
          endpoint: '/api/data',
          method: 'POST'
        }
      };

      const executionState = { variables: {} };
      const result = await executor.executeApiCallNode(node, executionState);

      expect(result.variables.api_response).toBeDefined();
    });
  });

  describe('executeSetVariableNode', () => {
    it('should set variable with static value', async () => {
      const node = {
        id: 'set_1',
        type: 'set_variable',
        data: {
          variableName: 'status',
          value: 'active'
        }
      };

      const executionState = { variables: {} };
      const result = await executor.executeSetVariableNode(node, executionState);

      expect(result.output.type).toBe('variable_set');
      expect(result.variables.status).toBe('active');
    });

    it('should substitute variables in value', async () => {
      const node = {
        id: 'set_1',
        type: 'set_variable',
        data: {
          variableName: 'greeting',
          value: 'Hello {{name}}'
        }
      };

      const executionState = { variables: { name: 'Alice' } };
      const result = await executor.executeSetVariableNode(node, executionState);

      expect(result.variables.greeting).toBe('Hello Alice');
    });

    it('should evaluate expressions', async () => {
      const node = {
        id: 'set_1',
        type: 'set_variable',
        data: {
          variableName: 'total',
          expression: '10 + 20'
        }
      };

      const executionState = { variables: {} };
      const result = await executor.executeSetVariableNode(node, executionState);

      expect(result.variables.total).toBe(30);
    });

    it('should throw error if variableName is missing', async () => {
      const node = {
        id: 'set_1',
        type: 'set_variable',
        data: { value: 'test' }
      };

      const executionState = { variables: {} };

      await expect(executor.executeSetVariableNode(node, executionState)).rejects.toThrow('must specify variableName');
    });
  });

  describe('executeDelayNode', () => {
    it('should execute delay node', async () => {
      const node = {
        id: 'delay_1',
        type: 'delay',
        data: { duration: 5000 }
      };

      const executionState = { variables: {} };
      const result = await executor.executeDelayNode(node, executionState);

      expect(result.output.type).toBe('delay');
      expect(result.output.duration).toBe(5000);
      expect(result.waitForInput).toBe(false);
    });

    it('should use default duration if not specified', async () => {
      const node = {
        id: 'delay_1',
        type: 'delay',
        data: {}
      };

      const executionState = { variables: {} };
      const result = await executor.executeDelayNode(node, executionState);

      expect(result.output.duration).toBe(1000);
    });
  });

  describe('executeEmailNode', () => {
    it('should execute email node', async () => {
      const node = {
        id: 'email_1',
        type: 'email',
        data: {
          to: 'user@example.com',
          subject: 'Welcome',
          content: 'Welcome to our service!'
        }
      };

      const executionState = { variables: {} };
      const result = await executor.executeEmailNode(node, executionState);

      expect(result.output.type).toBe('email');
      expect(result.output.to).toBe('user@example.com');
      expect(result.output.subject).toBe('Welcome');
      expect(result.output.sent).toBe(true);
    });

    it('should substitute variables in email fields', async () => {
      const node = {
        id: 'email_1',
        type: 'email',
        data: {
          to: '{{user_email}}',
          subject: 'Hello {{user_name}}',
          content: 'Your code is {{code}}'
        }
      };

      const executionState = {
        variables: {
          user_email: 'alice@example.com',
          user_name: 'Alice',
          code: '1234'
        }
      };

      const result = await executor.executeEmailNode(node, executionState);

      expect(result.output.to).toBe('alice@example.com');
      expect(result.output.subject).toBe('Hello Alice');
    });
  });

  describe('executeWebhookNode', () => {
    it('should execute webhook node', async () => {
      const node = {
        id: 'webhook_1',
        type: 'webhook',
        data: {
          url: 'https://example.com/webhook',
          method: 'POST',
          payload: { event: 'test' }
        }
      };

      const executionState = { variables: {} };
      const result = await executor.executeWebhookNode(node, executionState);

      expect(result.output.type).toBe('webhook');
      expect(result.output.url).toBe('https://example.com/webhook');
      expect(result.output.method).toBe('POST');
    });

    it('should substitute variables in webhook URL', async () => {
      const node = {
        id: 'webhook_1',
        type: 'webhook',
        data: {
          url: 'https://example.com/webhook/{{event_id}}',
          method: 'POST'
        }
      };

      const executionState = { variables: { event_id: 'evt_123' } };
      const result = await executor.executeWebhookNode(node, executionState);

      expect(result.output.url).toBe('https://example.com/webhook/evt_123');
    });
  });

  describe('executeAiResponseNode', () => {
    it('should execute AI response node', async () => {
      const node = {
        id: 'ai_1',
        type: 'ai_response',
        data: {
          content: 'What is the capital of France?'
        }
      };

      const executionState = { variables: {} };
      const result = await executor.executeAiResponseNode(node, executionState);

      expect(result.output.type).toBe('ai_response');
      expect(result.output.content).toContain('AI response to:');
      expect(result.variables.ai_response).toBeDefined();
    });

    it('should use custom response variable name', async () => {
      const node = {
        id: 'ai_1',
        type: 'ai_response',
        data: {
          prompt: 'Generate greeting',
          responseVariable: 'custom_response'
        }
      };

      const executionState = { variables: {} };
      const result = await executor.executeAiResponseNode(node, executionState);

      expect(result.variables.custom_response).toBeDefined();
    });

    it('should substitute variables in prompt', async () => {
      const node = {
        id: 'ai_1',
        type: 'ai_response',
        data: {
          content: 'Tell me about {{topic}}'
        }
      };

      const executionState = { variables: { topic: 'AI' } };
      const result = await executor.executeAiResponseNode(node, executionState);

      expect(result.output.content).toContain('Tell me about AI');
    });
  });

  describe('executeGotoNode', () => {
    it('should execute goto node', async () => {
      const node = {
        id: 'goto_1',
        type: 'goto',
        data: { targetNodeId: 'target_node' }
      };

      const executionState = { variables: {} };
      const result = await executor.executeGotoNode(node, executionState);

      expect(result.output.type).toBe('goto');
      expect(result.nextNodeId).toBe('target_node');
      expect(result.waitForInput).toBe(false);
    });

    it('should throw error if targetNodeId is missing', async () => {
      const node = {
        id: 'goto_1',
        type: 'goto',
        data: {}
      };

      const executionState = { variables: {} };

      await expect(executor.executeGotoNode(node, executionState)).rejects.toThrow('must specify targetNodeId');
    });
  });

  describe('executeEndNode', () => {
    it('should execute end node', async () => {
      const node = {
        id: 'end_1',
        type: 'end',
        data: { content: 'Thank you!' }
      };

      const executionState = { variables: {} };
      const result = await executor.executeEndNode(node, executionState);

      expect(result.output.type).toBe('end');
      expect(result.output.content).toBe('Thank you!');
      expect(result.waitForInput).toBe(false);
    });

    it('should use default message if content is missing', async () => {
      const node = {
        id: 'end_1',
        type: 'end',
        data: {}
      };

      const executionState = { variables: {} };
      const result = await executor.executeEndNode(node, executionState);

      expect(result.output.content).toBe('Flow completed');
    });
  });

  describe('substituteVariables', () => {
    it('should substitute single variable', () => {
      const text = 'Hello {{name}}';
      const variables = { name: 'World' };

      const result = executor.substituteVariables(text, variables);

      expect(result).toBe('Hello World');
    });

    it('should substitute multiple variables', () => {
      const text = '{{greeting}} {{name}}, you have {{count}} messages';
      const variables = { greeting: 'Hi', name: 'Alice', count: 5 };

      const result = executor.substituteVariables(text, variables);

      expect(result).toBe('Hi Alice, you have 5 messages');
    });

    it('should keep placeholder if variable not found', () => {
      const text = 'Hello {{name}}';
      const variables = {};

      const result = executor.substituteVariables(text, variables);

      expect(result).toBe('Hello {{name}}');
    });

    it('should handle variables with spaces', () => {
      const text = 'Value: {{ variable_name }}';
      const variables = { variable_name: '123' };

      const result = executor.substituteVariables(text, variables);

      expect(result).toBe('Value: 123');
    });

    it('should return non-string values as-is', () => {
      const number = 42;
      const result = executor.substituteVariables(number, {});

      expect(result).toBe(42);
    });
  });

  describe('validateInput', () => {
    it('should validate email addresses', () => {
      expect(executor.validateInput('user@example.com', 'email')).toBe(true);
      expect(executor.validateInput('invalid-email', 'email')).toBe(false);
      expect(executor.validateInput('no@domain', 'email')).toBe(false);
    });

    it('should validate phone numbers', () => {
      expect(executor.validateInput('1234567890', 'phone')).toBe(true);
      expect(executor.validateInput('+1 (555) 123-4567', 'phone')).toBe(true);
      expect(executor.validateInput('123', 'phone')).toBe(false);
      expect(executor.validateInput('abc', 'phone')).toBe(false);
    });

    it('should validate URLs', () => {
      expect(executor.validateInput('https://example.com', 'url')).toBe(true);
      expect(executor.validateInput('http://test.org/path', 'url')).toBe(true);
      expect(executor.validateInput('not-a-url', 'url')).toBe(false);
    });

    it('should validate numbers', () => {
      expect(executor.validateInput('123', 'number')).toBe(true);
      expect(executor.validateInput('45.67', 'number')).toBe(true);
      expect(executor.validateInput('abc', 'number')).toBe(false);
    });

    it('should validate dates', () => {
      expect(executor.validateInput('2024-01-01', 'date')).toBe(true);
      expect(executor.validateInput('January 1, 2024', 'date')).toBe(true);
      expect(executor.validateInput('not-a-date', 'date')).toBe(false);
    });

    it('should validate time', () => {
      expect(executor.validateInput('14:30', 'time')).toBe(true);
      expect(executor.validateInput('9:15', 'time')).toBe(true);
      expect(executor.validateInput('25:00', 'time')).toBe(false);
      expect(executor.validateInput('14:61', 'time')).toBe(false);
    });

    it('should return true for unknown validation types', () => {
      expect(executor.validateInput('anything', 'unknown')).toBe(true);
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate equals operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'status', operator: 'equals', value: 'active' },
        { status: 'active' }
      )).toBe(true);

      expect(executor.evaluateCondition(
        { variable: 'status', operator: 'eq', value: 'active' },
        { status: 'inactive' }
      )).toBe(false);
    });

    it('should evaluate not_equals operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'status', operator: 'not_equals', value: 'inactive' },
        { status: 'active' }
      )).toBe(true);
    });

    it('should evaluate greater_than operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'age', operator: 'greater_than', value: '18' },
        { age: 21 }
      )).toBe(true);

      expect(executor.evaluateCondition(
        { variable: 'age', operator: 'gt', value: '18' },
        { age: 15 }
      )).toBe(false);
    });

    it('should evaluate greater_than_equals operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'score', operator: 'gte', value: '100' },
        { score: 100 }
      )).toBe(true);
    });

    it('should evaluate less_than operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'count', operator: 'lt', value: '10' },
        { count: 5 }
      )).toBe(true);
    });

    it('should evaluate less_than_equals operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'price', operator: 'lte', value: '100' },
        { price: 100 }
      )).toBe(true);
    });

    it('should evaluate contains operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'message', operator: 'contains', value: 'hello' },
        { message: 'hello world' }
      )).toBe(true);
    });

    it('should evaluate not_contains operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'text', operator: 'not_contains', value: 'bad' },
        { text: 'good text' }
      )).toBe(true);
    });

    it('should evaluate starts_with operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'name', operator: 'starts_with', value: 'Mr.' },
        { name: 'Mr. Smith' }
      )).toBe(true);
    });

    it('should evaluate ends_with operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'file', operator: 'ends_with', value: '.pdf' },
        { file: 'document.pdf' }
      )).toBe(true);
    });

    it('should evaluate is_empty operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'value', operator: 'is_empty' },
        { value: '' }
      )).toBe(true);

      expect(executor.evaluateCondition(
        { variable: 'value', operator: 'is_empty' },
        { value: 'data' }
      )).toBe(false);
    });

    it('should evaluate is_not_empty operator', () => {
      expect(executor.evaluateCondition(
        { variable: 'value', operator: 'is_not_empty' },
        { value: 'data' }
      )).toBe(true);

      expect(executor.evaluateCondition(
        { variable: 'value', operator: 'is_not_empty' },
        { value: '' }
      )).toBe(false);
    });

    it('should return false for unknown operators', () => {
      expect(executor.evaluateCondition(
        { variable: 'x', operator: 'unknown', value: 'y' },
        { x: 'z' }
      )).toBe(false);
    });
  });

  describe('evaluateExpression', () => {
    it('should evaluate simple math expressions', () => {
      expect(executor.evaluateExpression('10 + 5', {})).toBe(15);
      expect(executor.evaluateExpression('20 - 8', {})).toBe(12);
      expect(executor.evaluateExpression('6 * 7', {})).toBe(42);
      expect(executor.evaluateExpression('100 / 4', {})).toBe(25);
    });

    it('should substitute variables before evaluation', () => {
      const result = executor.evaluateExpression('{{a}} + {{b}}', { a: 10, b: 20 });
      expect(result).toBe(30);
    });

    it('should return string for non-math expressions', () => {
      const result = executor.evaluateExpression('hello world', {});
      expect(result).toBe('hello world');
    });

    it('should handle complex expressions', () => {
      expect(executor.evaluateExpression('(10 + 5) * 2', {})).toBe(30);
      expect(executor.evaluateExpression('100 / (5 + 5)', {})).toBe(10);
    });

    it('should return original string if evaluation fails', () => {
      const result = executor.evaluateExpression('{{var}} + invalid', { var: 10 });
      expect(result).toBe('10 + invalid');
    });
  });

  describe('edge cases', () => {
    it('should handle node with empty data', async () => {
      const node = {
        id: 'node_1',
        type: 'message',
        data: {}
      };

      const executionState = { variables: {} };
      const result = await executor.execute(node, executionState);

      expect(result.success).toBe(true);
    });

    it('should handle missing variables gracefully', () => {
      const text = '{{missing}}';
      const result = executor.substituteVariables(text, {});

      expect(result).toBe('{{missing}}');
    });

    it('should handle null variables object', () => {
      const text = 'Hello {{name}}';
      const result = executor.substituteVariables(text, null);

      expect(result).toBe('Hello {{name}}');
    });

    it('should handle variables with undefined values', () => {
      const text = 'Value: {{value}}';
      const variables = { value: undefined };

      const result = executor.substituteVariables(text, variables);

      expect(result).toBe('Value: {{value}}');
    });

    it('should handle numeric variable values', () => {
      const text = 'Count: {{count}}';
      const variables = { count: 42 };

      const result = executor.substituteVariables(text, variables);

      expect(result).toBe('Count: 42');
    });
  });
});

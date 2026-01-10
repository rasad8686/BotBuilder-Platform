/**
 * IVR Simulator Service
 * Handles IVR flow simulation for testing without actual phone calls
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const ivrService = require('./ivr.service');
const ivrExecutor = require('./ivr-executor.service');

class IVRSimulatorService {
  constructor() {
    // Active simulations cache
    this.simulations = new Map();

    // Test scenarios storage
    this.testScenarios = new Map();
  }

  // ==================== SIMULATION CONTROL ====================

  /**
   * Start a new simulation
   */
  async simulateCall(flowId, testNumber = '+15551234567', options = {}) {
    const flow = await ivrService.getFlowById(flowId);
    if (!flow) {
      throw new Error('Flow not found');
    }

    const simulationId = `sim_${uuidv4()}`;
    const callSid = `SIM${Date.now()}`;

    // Find entry point
    const entryNode = flow.nodes.find(n => n.is_entry_point || n.type === 'start');
    if (!entryNode) {
      throw new Error('No entry point found in flow');
    }

    const simulation = {
      id: simulationId,
      flowId,
      callSid,
      testNumber,
      status: 'active',
      currentNodeId: entryNode.id,
      variables: {},
      inputHistory: [],
      navigationPath: [],
      responses: [],
      executionLog: [],
      startedAt: new Date(),
      debugMode: options.debugMode || false,
      stepByStep: options.stepByStep || false,
      paused: false
    };

    // Cache simulation
    this.simulations.set(simulationId, simulation);

    // Log start
    this.addExecutionLog(simulation, 'simulation_started', {
      flowId,
      testNumber,
      entryNodeId: entryNode.id
    });

    // Execute entry node
    const result = await this.executeCurrentNode(simulation);

    return {
      simulationId,
      callSid,
      status: simulation.status,
      currentNode: this.getNodeInfo(flow, simulation.currentNodeId),
      response: result,
      variables: simulation.variables,
      navigationPath: simulation.navigationPath
    };
  }

  /**
   * Send digit input to simulation
   */
  async simulateInput(simulationId, digit) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    if (simulation.status !== 'active') {
      throw new Error('Simulation is not active');
    }

    // Record input
    simulation.inputHistory.push({
      type: 'digit',
      value: digit,
      timestamp: new Date(),
      nodeId: simulation.currentNodeId
    });

    this.addExecutionLog(simulation, 'digit_input', {
      digit,
      nodeId: simulation.currentNodeId
    });

    // Execute with input
    const result = await this.executeWithInput(simulation, digit, 'digit');

    const flow = await ivrService.getFlowById(simulation.flowId);

    return {
      simulationId,
      status: simulation.status,
      currentNode: this.getNodeInfo(flow, simulation.currentNodeId),
      response: result,
      variables: simulation.variables,
      navigationPath: simulation.navigationPath
    };
  }

  /**
   * Send speech input to simulation
   */
  async simulateSpeech(simulationId, text) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    if (simulation.status !== 'active') {
      throw new Error('Simulation is not active');
    }

    // Record input
    simulation.inputHistory.push({
      type: 'speech',
      value: text,
      timestamp: new Date(),
      nodeId: simulation.currentNodeId
    });

    this.addExecutionLog(simulation, 'speech_input', {
      text,
      nodeId: simulation.currentNodeId
    });

    // Execute with input
    const result = await this.executeWithInput(simulation, text, 'speech');

    const flow = await ivrService.getFlowById(simulation.flowId);

    return {
      simulationId,
      status: simulation.status,
      currentNode: this.getNodeInfo(flow, simulation.currentNodeId),
      response: result,
      variables: simulation.variables,
      navigationPath: simulation.navigationPath
    };
  }

  /**
   * Get current simulation state
   */
  async getSimulatorState(simulationId) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    const flow = await ivrService.getFlowById(simulation.flowId);
    const currentNode = flow.nodes.find(n => n.id === simulation.currentNodeId);

    return {
      simulationId,
      status: simulation.status,
      currentNode: this.getNodeInfo(flow, simulation.currentNodeId),
      currentNodeFull: currentNode,
      variables: simulation.variables,
      inputHistory: simulation.inputHistory,
      navigationPath: simulation.navigationPath,
      responses: simulation.responses,
      executionLog: simulation.executionLog,
      startedAt: simulation.startedAt,
      paused: simulation.paused,
      debugMode: simulation.debugMode
    };
  }

  /**
   * End simulation
   */
  async endSimulation(simulationId) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    simulation.status = 'ended';
    simulation.endedAt = new Date();

    this.addExecutionLog(simulation, 'simulation_ended', {
      duration: Date.now() - new Date(simulation.startedAt).getTime(),
      nodesVisited: simulation.navigationPath.length,
      inputsReceived: simulation.inputHistory.length
    });

    // Save to history
    await this.saveSimulationHistory(simulation);

    // Remove from active simulations after a delay
    setTimeout(() => {
      this.simulations.delete(simulationId);
    }, 60000); // Keep for 1 minute for final state retrieval

    return {
      simulationId,
      status: 'ended',
      summary: {
        duration: Date.now() - new Date(simulation.startedAt).getTime(),
        nodesVisited: simulation.navigationPath.length,
        inputsReceived: simulation.inputHistory.length,
        finalVariables: simulation.variables
      }
    };
  }

  /**
   * Get simulation history for a flow
   */
  async getSimulationHistory(flowId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const [history, countResult] = await Promise.all([
      db('ivr_simulation_history')
        .where({ flow_id: flowId })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset),
      db('ivr_simulation_history')
        .where({ flow_id: flowId })
        .count('* as total')
        .first()
    ]);

    return {
      history: history.map(h => ({
        ...h,
        data: typeof h.data === 'string' ? JSON.parse(h.data) : h.data
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.total),
        totalPages: Math.ceil(countResult.total / limit)
      }
    };
  }

  // ==================== DEBUG MODE ====================

  /**
   * Pause simulation (step-by-step mode)
   */
  pauseSimulation(simulationId) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    simulation.paused = true;
    this.addExecutionLog(simulation, 'simulation_paused', {});

    return { simulationId, paused: true };
  }

  /**
   * Resume simulation
   */
  resumeSimulation(simulationId) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    simulation.paused = false;
    this.addExecutionLog(simulation, 'simulation_resumed', {});

    return { simulationId, paused: false };
  }

  /**
   * Step to next node (debug mode)
   */
  async stepNext(simulationId) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    if (!simulation.debugMode) {
      throw new Error('Debug mode not enabled');
    }

    // Execute current node and move to next
    const result = await this.executeCurrentNode(simulation);

    const flow = await ivrService.getFlowById(simulation.flowId);

    return {
      simulationId,
      status: simulation.status,
      currentNode: this.getNodeInfo(flow, simulation.currentNodeId),
      response: result,
      variables: simulation.variables,
      executionLog: simulation.executionLog.slice(-10) // Last 10 entries
    };
  }

  /**
   * Set variable manually (debug mode)
   */
  setVariable(simulationId, name, value) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    simulation.variables[name] = value;

    this.addExecutionLog(simulation, 'variable_set_manual', {
      name,
      value
    });

    return { simulationId, variables: simulation.variables };
  }

  /**
   * Jump to specific node (debug mode)
   */
  async jumpToNode(simulationId, nodeId) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    if (!simulation.debugMode) {
      throw new Error('Debug mode not enabled');
    }

    const flow = await ivrService.getFlowById(simulation.flowId);
    const node = flow.nodes.find(n => n.id === nodeId);

    if (!node) {
      throw new Error('Node not found');
    }

    simulation.currentNodeId = nodeId;
    simulation.navigationPath.push({
      nodeId,
      timestamp: new Date(),
      jumped: true
    });

    this.addExecutionLog(simulation, 'jumped_to_node', {
      nodeId,
      nodeType: node.type
    });

    return {
      simulationId,
      currentNode: this.getNodeInfo(flow, nodeId)
    };
  }

  /**
   * Get TwiML preview for current node
   */
  async getTwiMLPreview(simulationId) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    const flow = await ivrService.getFlowById(simulation.flowId);
    const currentNode = flow.nodes.find(n => n.id === simulation.currentNodeId);

    if (!currentNode) {
      return { twiml: '' };
    }

    // Generate TwiML based on node type
    const twiml = this.generateTwiML(currentNode, simulation, flow);

    return { twiml, nodeType: currentNode.type };
  }

  // ==================== TEST SCENARIOS ====================

  /**
   * Run predefined test scenario
   */
  async runTestScenario(flowId, scenario) {
    const { name, inputs, expectedPath, expectedVariables } = scenario;

    // Start simulation
    const startResult = await this.simulateCall(flowId, scenario.testNumber || '+15551234567');
    const simulationId = startResult.simulationId;

    const results = {
      name,
      simulationId,
      passed: true,
      steps: [],
      errors: []
    };

    // Execute each input
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      let stepResult;

      try {
        if (input.type === 'digit') {
          stepResult = await this.simulateInput(simulationId, input.value);
        } else if (input.type === 'speech') {
          stepResult = await this.simulateSpeech(simulationId, input.value);
        } else if (input.type === 'wait') {
          await this.delay(input.duration || 1000);
          stepResult = await this.getSimulatorState(simulationId);
        }

        results.steps.push({
          input,
          result: stepResult,
          passed: true
        });

        // Check expected node if specified
        if (input.expectedNode && stepResult.currentNode?.id !== input.expectedNode) {
          results.passed = false;
          results.errors.push(`Step ${i + 1}: Expected node ${input.expectedNode}, got ${stepResult.currentNode?.id}`);
        }
      } catch (error) {
        results.passed = false;
        results.steps.push({
          input,
          error: error.message,
          passed: false
        });
        results.errors.push(`Step ${i + 1}: ${error.message}`);
        break;
      }
    }

    // Get final state
    const finalState = await this.getSimulatorState(simulationId);

    // Check expected path
    if (expectedPath && expectedPath.length > 0) {
      const actualPath = finalState.navigationPath.map(n => n.nodeId);
      const pathMatches = expectedPath.every((nodeId, idx) => actualPath[idx] === nodeId);

      if (!pathMatches) {
        results.passed = false;
        results.errors.push(`Path mismatch: expected ${expectedPath.join(' -> ')}, got ${actualPath.join(' -> ')}`);
      }
    }

    // Check expected variables
    if (expectedVariables) {
      for (const [key, value] of Object.entries(expectedVariables)) {
        if (finalState.variables[key] !== value) {
          results.passed = false;
          results.errors.push(`Variable ${key}: expected ${value}, got ${finalState.variables[key]}`);
        }
      }
    }

    // End simulation
    await this.endSimulation(simulationId);

    results.finalState = finalState;
    return results;
  }

  /**
   * Run happy path test (follow first option at each node)
   */
  async runHappyPathTest(flowId, maxSteps = 20) {
    const startResult = await this.simulateCall(flowId);
    const simulationId = startResult.simulationId;

    const results = {
      name: 'Happy Path Test',
      simulationId,
      steps: [],
      nodesVisited: []
    };

    let stepCount = 0;

    while (stepCount < maxSteps) {
      const state = await this.getSimulatorState(simulationId);

      if (state.status !== 'active') {
        break;
      }

      results.nodesVisited.push(state.currentNode);

      // If node requires input, send first option
      if (state.currentNode?.type === 'menu') {
        const options = state.currentNodeFull?.config?.options || [];
        if (options.length > 0) {
          const input = options[0].key || options[0].digit || '1';
          const result = await this.simulateInput(simulationId, input);
          results.steps.push({ input, result });
        } else {
          break;
        }
      } else if (state.currentNode?.type === 'input') {
        const result = await this.simulateInput(simulationId, '12345');
        results.steps.push({ input: '12345', result });
      } else {
        // Auto-continue nodes
        await this.delay(100);
      }

      stepCount++;
    }

    const finalState = await this.getSimulatorState(simulationId);
    await this.endSimulation(simulationId);

    results.finalState = finalState;
    results.completed = finalState.status === 'ended';

    return results;
  }

  /**
   * Run timeout test
   */
  async runTimeoutTest(flowId) {
    const startResult = await this.simulateCall(flowId);
    const simulationId = startResult.simulationId;

    const results = {
      name: 'Timeout Test',
      simulationId,
      steps: []
    };

    // Get to first input node
    let state = await this.getSimulatorState(simulationId);

    while (state.status === 'active' && !['menu', 'input'].includes(state.currentNode?.type)) {
      await this.delay(100);
      state = await this.getSimulatorState(simulationId);
    }

    if (['menu', 'input'].includes(state.currentNode?.type)) {
      // Simulate timeout by not sending input
      results.steps.push({
        action: 'wait_for_timeout',
        nodeType: state.currentNode.type
      });

      // In real scenario, this would trigger timeout handling
      // For simulation, we'll call handleTimeout directly
      const simulation = this.simulations.get(simulationId);
      const timeoutResult = await this.simulateTimeout(simulationId);

      results.steps.push({
        action: 'timeout_triggered',
        result: timeoutResult
      });
    }

    const finalState = await this.getSimulatorState(simulationId);
    await this.endSimulation(simulationId);

    results.finalState = finalState;
    return results;
  }

  /**
   * Simulate timeout
   */
  async simulateTimeout(simulationId) {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    this.addExecutionLog(simulation, 'timeout_simulated', {
      nodeId: simulation.currentNodeId
    });

    // Increment retry count
    const retryCount = (simulation.variables._retryCount || 0) + 1;
    simulation.variables._retryCount = retryCount;

    const flow = await ivrService.getFlowById(simulation.flowId);

    if (retryCount >= (flow.max_retries || 3)) {
      // Max retries - end or go to error handler
      simulation.status = 'ended';
      return {
        action: 'max_retries_exceeded',
        message: 'Maximum retries exceeded'
      };
    }

    return {
      action: 'retry',
      retryCount,
      maxRetries: flow.max_retries || 3
    };
  }

  /**
   * Save test scenario
   */
  saveTestScenario(flowId, scenario) {
    const scenarioId = scenario.id || uuidv4();
    const key = `${flowId}:${scenarioId}`;

    this.testScenarios.set(key, {
      ...scenario,
      id: scenarioId,
      flowId,
      savedAt: new Date()
    });

    return { scenarioId };
  }

  /**
   * Load test scenarios for a flow
   */
  loadTestScenarios(flowId) {
    const scenarios = [];

    for (const [key, scenario] of this.testScenarios) {
      if (key.startsWith(`${flowId}:`)) {
        scenarios.push(scenario);
      }
    }

    return scenarios;
  }

  // ==================== INTERNAL METHODS ====================

  /**
   * Execute current node
   */
  async executeCurrentNode(simulation) {
    const flow = await ivrService.getFlowById(simulation.flowId);
    const currentNode = flow.nodes.find(n => n.id === simulation.currentNodeId);

    if (!currentNode) {
      throw new Error('Current node not found');
    }

    // Track navigation
    simulation.navigationPath.push({
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeName: currentNode.name,
      timestamp: new Date()
    });

    this.addExecutionLog(simulation, 'node_entered', {
      nodeId: currentNode.id,
      nodeType: currentNode.type
    });

    // Build mock session for executor
    const mockSession = this.buildMockSession(simulation);

    // Process node
    const result = await this.processNodeForSimulation(currentNode, mockSession, flow);

    // Store response
    simulation.responses.push({
      nodeId: currentNode.id,
      response: result,
      timestamp: new Date()
    });

    // Update simulation state based on result
    if (result.nextNodeId) {
      simulation.currentNodeId = result.nextNodeId;
    }

    if (result.next === 'hangup' || result.action === 'hangup') {
      simulation.status = 'ended';
    }

    // Copy variables from mock session
    Object.assign(simulation.variables, mockSession.variables);

    return result;
  }

  /**
   * Execute with input
   */
  async executeWithInput(simulation, input, inputType) {
    const flow = await ivrService.getFlowById(simulation.flowId);
    const currentNode = flow.nodes.find(n => n.id === simulation.currentNodeId);

    if (!currentNode) {
      throw new Error('Current node not found');
    }

    const mockSession = this.buildMockSession(simulation);

    // Process with input
    const result = await this.processNodeWithInput(currentNode, mockSession, flow, input, inputType);

    // Store response
    simulation.responses.push({
      nodeId: currentNode.id,
      input: { type: inputType, value: input },
      response: result,
      timestamp: new Date()
    });

    // Update state
    if (result.nextNodeId) {
      simulation.currentNodeId = result.nextNodeId;

      // Track new node
      simulation.navigationPath.push({
        nodeId: result.nextNodeId,
        timestamp: new Date()
      });

      // If continue flag, process next node automatically
      if (result.continue) {
        const nextResult = await this.executeCurrentNode(simulation);
        return nextResult;
      }
    }

    if (result.next === 'hangup' || result.action === 'hangup') {
      simulation.status = 'ended';
    }

    Object.assign(simulation.variables, mockSession.variables);

    return result;
  }

  /**
   * Process node for simulation
   */
  async processNodeForSimulation(node, session, flow) {
    const config = node.config || {};

    switch (node.type) {
      case 'start':
        return {
          action: 'say',
          text: config.message || flow.welcome_message || 'Welcome',
          voice: flow.voice,
          nextNodeId: this.getFirstConnection(node),
          continue: true
        };

      case 'play':
        return {
          action: config.audioUrl ? 'play' : 'say',
          text: this.interpolate(config.message || '', session),
          url: config.audioUrl,
          voice: flow.voice,
          nextNodeId: this.getFirstConnection(node),
          continue: true
        };

      case 'menu':
        return {
          action: 'gather',
          text: this.buildMenuPrompt(config, session),
          voice: flow.voice,
          numDigits: config.numDigits || 1,
          timeout: config.timeout || 5,
          waitingForInput: true
        };

      case 'input':
        return {
          action: 'gather',
          text: this.interpolate(config.prompt || 'Please enter your input.', session),
          voice: flow.voice,
          inputType: config.inputType || 'dtmf',
          waitingForInput: true
        };

      case 'condition':
        const matchedConnection = this.evaluateCondition(node, session);
        return {
          action: 'continue',
          nextNodeId: matchedConnection,
          continue: true
        };

      case 'set_variable':
        session.variables[config.variableName] = config.value;
        return {
          action: 'continue',
          nextNodeId: this.getFirstConnection(node),
          continue: true,
          variableSet: { name: config.variableName, value: config.value }
        };

      case 'transfer':
        return {
          action: 'dial',
          number: config.phoneNumber,
          sipUri: config.sipUri,
          next: 'end'
        };

      case 'voicemail':
        return {
          action: 'record',
          text: config.message || 'Please leave a message.',
          voice: flow.voice,
          next: 'end'
        };

      case 'hangup':
      case 'end':
        return {
          action: 'say',
          text: config.message || flow.goodbye_message || 'Goodbye.',
          voice: flow.voice,
          next: 'hangup'
        };

      case 'api_call':
        // Simulate API call
        return {
          action: 'api_call',
          url: config.url,
          method: config.method,
          simulated: true,
          nextNodeId: this.getFirstConnection(node),
          continue: true
        };

      case 'ai_response':
        return {
          action: 'say',
          text: '[AI Response would be generated here]',
          voice: flow.voice,
          simulated: true,
          nextNodeId: this.getFirstConnection(node),
          continue: true
        };

      default:
        return {
          action: 'continue',
          nextNodeId: this.getFirstConnection(node),
          continue: true
        };
    }
  }

  /**
   * Process node with input
   */
  async processNodeWithInput(node, session, flow, input, inputType) {
    const config = node.config || {};

    if (node.type === 'menu') {
      const options = config.options || [];
      const selectedOption = options.find(o => o.key === input || o.digit === input);

      if (selectedOption) {
        // Find connection for this option
        const connection = (node.connections || []).find(c =>
          c.sourceHandle === input || c.key === input
        );

        if (connection) {
          return {
            action: 'continue',
            selectedOption: input,
            nextNodeId: connection.targetNodeId
          };
        }
      }

      // Invalid input
      const retryCount = (session.variables._retryCount || 0) + 1;
      session.variables._retryCount = retryCount;

      if (retryCount >= (flow.max_retries || 3)) {
        return {
          action: 'say',
          text: 'Maximum retries exceeded.',
          next: 'hangup'
        };
      }

      return {
        action: 'gather',
        text: config.invalidMessage || 'Invalid option. Please try again.',
        voice: flow.voice,
        retry: true
      };
    }

    if (node.type === 'input') {
      // Save input
      const varName = config.variableName || '_lastInput';
      session.variables[varName] = input;

      return {
        action: 'continue',
        inputSaved: { name: varName, value: input },
        nextNodeId: this.getFirstConnection(node)
      };
    }

    return {
      action: 'continue',
      nextNodeId: this.getFirstConnection(node)
    };
  }

  /**
   * Build mock session object
   */
  buildMockSession(simulation) {
    return {
      id: simulation.id,
      flow_id: simulation.flowId,
      call_sid: simulation.callSid,
      from_number: simulation.testNumber,
      variables: { ...simulation.variables },
      input_history: simulation.inputHistory,
      navigation_path: simulation.navigationPath
    };
  }

  /**
   * Get first connection target
   */
  getFirstConnection(node) {
    if (node.connections && node.connections.length > 0) {
      const defaultConn = node.connections.find(c =>
        c.sourceHandle === 'default' || !c.sourceHandle
      );
      return (defaultConn || node.connections[0]).targetNodeId;
    }
    return null;
  }

  /**
   * Evaluate condition for simulation
   */
  evaluateCondition(node, session) {
    const config = node.config || {};
    const conditions = config.conditions || [];

    for (const condition of conditions) {
      const { variable, operator, value } = condition;
      const actualValue = session.variables[variable];

      let matched = false;
      switch (operator) {
        case 'equals':
        case '==':
          matched = actualValue == value;
          break;
        case 'not_equals':
        case '!=':
          matched = actualValue != value;
          break;
        case 'contains':
          matched = String(actualValue).includes(value);
          break;
        case 'greater_than':
        case '>':
          matched = Number(actualValue) > Number(value);
          break;
        case 'less_than':
        case '<':
          matched = Number(actualValue) < Number(value);
          break;
      }

      if (matched) {
        const conn = (node.connections || []).find(c => c.sourceHandle === condition.id);
        if (conn) return conn.targetNodeId;
      }
    }

    // Default/else
    const elseConn = (node.connections || []).find(c =>
      c.sourceHandle === 'else' || c.sourceHandle === 'default'
    );
    return elseConn?.targetNodeId;
  }

  /**
   * Interpolate variables
   */
  interpolate(text, session) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return session.variables[varName] || match;
    });
  }

  /**
   * Build menu prompt
   */
  buildMenuPrompt(config, session) {
    if (config.message) return this.interpolate(config.message, session);

    let prompt = config.prompt || 'Please select an option: ';
    const options = config.options || [];

    options.forEach(opt => {
      prompt += `Press ${opt.key || opt.digit} for ${opt.label}. `;
    });

    return this.interpolate(prompt, session);
  }

  /**
   * Get node info for response
   */
  getNodeInfo(flow, nodeId) {
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    return {
      id: node.id,
      type: node.type,
      name: node.name,
      config: node.config
    };
  }

  /**
   * Generate TwiML preview
   */
  generateTwiML(node, simulation, flow) {
    const config = node.config || {};
    const voice = config.voice || flow.voice || 'Polly.Joanna';

    let twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';

    switch (node.type) {
      case 'start':
      case 'play':
        if (config.audioUrl) {
          twiml += `  <Play>${config.audioUrl}</Play>\n`;
        } else {
          twiml += `  <Say voice="${voice}">${config.message || ''}</Say>\n`;
        }
        break;

      case 'menu':
        twiml += `  <Gather numDigits="${config.numDigits || 1}" timeout="${config.timeout || 5}">\n`;
        twiml += `    <Say voice="${voice}">${this.buildMenuPrompt(config, { variables: simulation.variables })}</Say>\n`;
        twiml += `  </Gather>\n`;
        break;

      case 'input':
        twiml += `  <Gather input="${config.inputType || 'dtmf'}" timeout="${config.timeout || 5}">\n`;
        twiml += `    <Say voice="${voice}">${config.prompt || ''}</Say>\n`;
        twiml += `  </Gather>\n`;
        break;

      case 'transfer':
        if (config.sipUri) {
          twiml += `  <Dial><Sip>${config.sipUri}</Sip></Dial>\n`;
        } else {
          twiml += `  <Dial>${config.phoneNumber}</Dial>\n`;
        }
        break;

      case 'voicemail':
        twiml += `  <Say voice="${voice}">${config.message || 'Please leave a message.'}</Say>\n`;
        twiml += `  <Record maxLength="${config.maxLength || 120}" />\n`;
        break;

      case 'hangup':
      case 'end':
        twiml += `  <Say voice="${voice}">${config.message || flow.goodbye_message || 'Goodbye.'}</Say>\n`;
        twiml += `  <Hangup />\n`;
        break;

      default:
        twiml += `  <!-- Node type: ${node.type} -->\n`;
    }

    twiml += '</Response>';
    return twiml;
  }

  /**
   * Add execution log entry
   */
  addExecutionLog(simulation, event, data) {
    simulation.executionLog.push({
      event,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Save simulation to history
   */
  async saveSimulationHistory(simulation) {
    try {
      await db('ivr_simulation_history').insert({
        id: uuidv4(),
        flow_id: simulation.flowId,
        simulation_id: simulation.id,
        test_number: simulation.testNumber,
        status: simulation.status,
        data: JSON.stringify({
          variables: simulation.variables,
          inputHistory: simulation.inputHistory,
          navigationPath: simulation.navigationPath,
          responses: simulation.responses,
          executionLog: simulation.executionLog
        }),
        duration_ms: Date.now() - new Date(simulation.startedAt).getTime(),
        created_at: simulation.startedAt,
        ended_at: simulation.endedAt
      });
    } catch (error) {
      console.error('Error saving simulation history:', error.message);
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new IVRSimulatorService();

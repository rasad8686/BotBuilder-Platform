/**
 * IVR Executor Service
 * Handles IVR flow execution, node processing, and session management
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const ivrService = require('./ivr.service');

class IVRExecutorService {
  constructor() {
    // In-memory session cache for fast access
    this.sessionCache = new Map();

    // Node type handlers
    this.nodeHandlers = {
      start: this.handleStart.bind(this),
      play: this.handlePlayMessage.bind(this),
      menu: this.handleMenu.bind(this),
      input: this.handleInput.bind(this),
      transfer: this.handleTransfer.bind(this),
      voicemail: this.handleVoicemail.bind(this),
      condition: this.handleCondition.bind(this),
      set_variable: this.handleSetVariable.bind(this),
      api_call: this.handleAPICall.bind(this),
      ai_response: this.handleAIResponse.bind(this),
      hangup: this.handleHangup.bind(this),
      end: this.handleHangup.bind(this),
      goto: this.handleGoto.bind(this),
      wait: this.handleWait.bind(this),
      record: this.handleRecord.bind(this),
      sms: this.handleSMS.bind(this)
    };
  }

  // ==================== FLOW EXECUTION ====================

  /**
   * Execute IVR flow
   * @param {string} flowId - Flow ID
   * @param {string} callSid - Twilio Call SID
   * @param {string} input - User input (digit or speech)
   * @param {string} inputType - Input type: 'digit', 'speech', 'start'
   */
  async executeFlow(flowId, callSid, input = null, inputType = 'start') {
    try {
      // Get or create session
      let session = await this.getSession(callSid);

      if (!session) {
        // New call - create session
        const flow = await ivrService.getFlowById(flowId);
        if (!flow) {
          throw new Error('Flow not found');
        }

        session = await this.createSession(flowId, callSid, input);

        // Find entry point
        const entryNode = flow.nodes.find(n => n.is_entry_point || n.type === 'start');
        if (!entryNode) {
          throw new Error('No entry point found in flow');
        }

        session.current_node_id = entryNode.id;
        await this.updateSession(callSid, { current_node_id: entryNode.id });

        // Increment call count
        await ivrService.incrementCallCount(flowId);
      }

      // Get current node
      const flow = await ivrService.getFlowById(session.flow_id);
      const currentNode = flow.nodes.find(n => n.id === session.current_node_id);

      if (!currentNode) {
        return this.generateErrorResponse(session, 'Node not found');
      }

      // Process the node
      const result = await this.processNode(currentNode, session, input, inputType);

      return result;
    } catch (error) {
      console.error('IVR execution error:', error);
      return {
        action: 'say',
        text: 'An error occurred. Please try again later.',
        next: 'hangup'
      };
    }
  }

  /**
   * Process a node
   */
  async processNode(node, session, input, inputType) {
    // Track navigation
    await this.trackNavigation(session, node.id);

    // Log analytics event
    await this.logAnalyticsEvent(session, node.id, 'node_entered', { inputType, input });

    // Get handler for node type
    const handler = this.nodeHandlers[node.type];

    if (!handler) {
      console.error(`Unknown node type: ${node.type}`);
      return this.handleUnknownNode(node, session);
    }

    // Execute handler
    const result = await handler(node, session, input, inputType);

    // If result specifies next node, update session
    if (result.nextNodeId) {
      await this.updateSession(session.call_sid, {
        current_node_id: result.nextNodeId
      });
    }

    return result;
  }

  /**
   * Get next node based on current node and input
   */
  async getNextNode(currentNode, session, input) {
    const flow = await ivrService.getFlowById(session.flow_id);

    // Find connection based on input or default
    let connection = null;

    if (currentNode.connections && currentNode.connections.length > 0) {
      // For menu nodes, find connection matching input
      if (currentNode.type === 'menu' && input) {
        connection = currentNode.connections.find(c => c.sourceHandle === input || c.key === input);
      }

      // For condition nodes, find matching condition
      if (currentNode.type === 'condition') {
        connection = this.evaluateCondition(currentNode, session);
      }

      // Default connection
      if (!connection) {
        connection = currentNode.connections.find(c => c.sourceHandle === 'default' || !c.sourceHandle);
      }

      // First available connection
      if (!connection && currentNode.connections.length > 0) {
        connection = currentNode.connections[0];
      }
    }

    if (connection && connection.targetNodeId) {
      return flow.nodes.find(n => n.id === connection.targetNodeId);
    }

    return null;
  }

  // ==================== NODE HANDLERS ====================

  /**
   * Handle start node
   */
  async handleStart(node, session, input, inputType) {
    const flow = await ivrService.getFlowById(session.flow_id);

    // Get welcome message from flow or node config
    const welcomeMessage = node.config?.message || flow.welcome_message || 'Welcome';

    // Get next node
    const nextNode = await this.getNextNode(node, session);

    if (nextNode) {
      await this.updateSession(session.call_sid, { current_node_id: nextNode.id });
      return {
        action: 'say',
        text: welcomeMessage,
        voice: flow.voice,
        nextNodeId: nextNode.id,
        continue: true
      };
    }

    return {
      action: 'say',
      text: welcomeMessage,
      voice: flow.voice,
      next: 'hangup'
    };
  }

  /**
   * Handle play message node
   */
  async handlePlayMessage(node, session, input, inputType) {
    const flow = await ivrService.getFlowById(session.flow_id);
    const config = node.config || {};

    const response = {
      action: config.audioUrl ? 'play' : 'say',
      voice: config.voice || flow.voice
    };

    if (config.audioUrl) {
      response.url = config.audioUrl;
    } else {
      response.text = this.interpolateVariables(config.message || '', session);
    }

    // Get next node
    const nextNode = await this.getNextNode(node, session);

    if (nextNode) {
      response.nextNodeId = nextNode.id;
      response.continue = true;
    } else {
      response.next = 'hangup';
    }

    return response;
  }

  /**
   * Handle menu node (gather digits)
   */
  async handleMenu(node, session, input, inputType) {
    const flow = await ivrService.getFlowById(session.flow_id);
    const config = node.config || {};
    const retryCount = session.variables?._retryCount || 0;

    // If input provided, process the selection
    if (input && inputType === 'digit') {
      const options = config.options || [];
      const selectedOption = options.find(o => o.key === input || o.digit === input);

      if (selectedOption) {
        // Valid selection - track it
        await this.trackMenuSelection(session.flow_id, node.id, input);
        await this.logAnalyticsEvent(session, node.id, 'menu_selection', { digit: input });

        // Reset retry count
        await this.setVariable(session, '_retryCount', 0);

        // Find next node for this option
        const connection = (node.connections || []).find(c =>
          c.sourceHandle === input || c.key === input || c.digit === input
        );

        if (connection && connection.targetNodeId) {
          return {
            action: 'continue',
            nextNodeId: connection.targetNodeId
          };
        }
      }

      // Invalid input - retry
      if (retryCount < (flow.max_retries || 3)) {
        await this.setVariable(session, '_retryCount', retryCount + 1);
        return {
          action: 'gather',
          text: config.invalidMessage || flow.error_message || 'Invalid option. Please try again.',
          voice: flow.voice,
          numDigits: config.numDigits || 1,
          timeout: config.timeout || flow.input_timeout / 1000,
          nextNodeId: node.id // Stay on same node
        };
      }

      // Max retries exceeded
      return this.handleMaxRetries(node, session);
    }

    // No input yet - prompt user
    const menuText = this.buildMenuPrompt(config);

    return {
      action: 'gather',
      text: this.interpolateVariables(menuText, session),
      voice: flow.voice,
      numDigits: config.numDigits || 1,
      timeout: config.timeout || flow.input_timeout / 1000,
      finishOnKey: config.finishOnKey || '#'
    };
  }

  /**
   * Handle input node (gather speech or digits)
   */
  async handleInput(node, session, input, inputType) {
    const flow = await ivrService.getFlowById(session.flow_id);
    const config = node.config || {};

    // If input provided, save it and continue
    if (input) {
      // Save input to variable
      const varName = config.variableName || config.saveAs || '_lastInput';
      await this.setVariable(session, varName, input);

      // Add to input history
      await this.addToInputHistory(session, {
        nodeId: node.id,
        input,
        inputType,
        timestamp: new Date()
      });

      await this.logAnalyticsEvent(session, node.id, 'input_received', { input, inputType });

      // Get next node
      const nextNode = await this.getNextNode(node, session);

      if (nextNode) {
        return {
          action: 'continue',
          nextNodeId: nextNode.id
        };
      }

      return { action: 'hangup' };
    }

    // Prompt for input
    const response = {
      action: 'gather',
      text: this.interpolateVariables(config.prompt || 'Please enter your input.', session),
      voice: flow.voice,
      timeout: config.timeout || flow.input_timeout / 1000
    };

    if (config.inputType === 'speech' || config.speech) {
      response.input = 'speech';
      response.speechTimeout = config.speechTimeout || flow.speech_timeout / 1000;
      response.language = config.language || flow.default_language;
    } else {
      response.input = 'dtmf';
      response.numDigits = config.numDigits || config.maxDigits || 10;
      response.finishOnKey = config.finishOnKey || '#';
    }

    return response;
  }

  /**
   * Handle transfer node
   */
  async handleTransfer(node, session, input, inputType) {
    const config = node.config || {};

    await this.logAnalyticsEvent(session, node.id, 'transfer', {
      targetNumber: config.phoneNumber,
      targetSip: config.sipUri
    });

    // End session with transfer
    await this.endSession(session.call_sid, 'transfer');

    if (config.sipUri) {
      return {
        action: 'dial_sip',
        sipUri: config.sipUri,
        callerId: config.callerId,
        timeout: config.timeout || 30
      };
    }

    return {
      action: 'dial',
      number: config.phoneNumber,
      callerId: config.callerId,
      timeout: config.timeout || 30,
      record: config.record || false,
      whisper: config.whisperMessage
    };
  }

  /**
   * Handle voicemail node
   */
  async handleVoicemail(node, session, input, inputType) {
    const flow = await ivrService.getFlowById(session.flow_id);
    const config = node.config || {};

    await this.logAnalyticsEvent(session, node.id, 'voicemail', {});

    return {
      action: 'record',
      text: config.message || 'Please leave a message after the beep.',
      voice: flow.voice,
      maxLength: config.maxLength || 120,
      playBeep: true,
      transcribe: config.transcribe !== false,
      transcribeCallback: config.transcribeCallback,
      recordingStatusCallback: config.statusCallback
    };
  }

  /**
   * Handle condition node
   */
  async handleCondition(node, session, input, inputType) {
    const config = node.config || {};
    const conditions = config.conditions || [];

    // Evaluate conditions
    let matchedConnection = null;

    for (const condition of conditions) {
      const result = this.evaluateSingleCondition(condition, session);
      if (result) {
        matchedConnection = (node.connections || []).find(c =>
          c.sourceHandle === condition.id || c.conditionId === condition.id
        );
        break;
      }
    }

    // If no match, use default/else connection
    if (!matchedConnection) {
      matchedConnection = (node.connections || []).find(c =>
        c.sourceHandle === 'else' || c.sourceHandle === 'default'
      );
    }

    if (matchedConnection && matchedConnection.targetNodeId) {
      await this.logAnalyticsEvent(session, node.id, 'condition_evaluated', {
        matched: !!matchedConnection
      });

      return {
        action: 'continue',
        nextNodeId: matchedConnection.targetNodeId
      };
    }

    return { action: 'hangup' };
  }

  /**
   * Handle set variable node
   */
  async handleSetVariable(node, session, input, inputType) {
    const config = node.config || {};

    const varName = config.variableName || config.name;
    let value = config.value;

    // Evaluate expression if needed
    if (config.expression) {
      value = this.evaluateExpression(config.expression, session);
    }

    await this.setVariable(session, varName, value);

    await this.logAnalyticsEvent(session, node.id, 'variable_set', {
      variable: varName,
      value
    });

    // Get next node
    const nextNode = await this.getNextNode(node, session);

    if (nextNode) {
      return {
        action: 'continue',
        nextNodeId: nextNode.id
      };
    }

    return { action: 'hangup' };
  }

  /**
   * Handle API call node
   */
  async handleAPICall(node, session, input, inputType) {
    const config = node.config || {};

    try {
      const axios = require('axios');

      // Prepare request
      const url = this.interpolateVariables(config.url, session);
      const method = config.method || 'GET';
      const headers = config.headers || {};
      let data = config.body;

      if (data && typeof data === 'string') {
        data = this.interpolateVariables(data, session);
        try {
          data = JSON.parse(data);
        } catch (e) {
          // Keep as string
        }
      }

      // Make request
      const response = await axios({
        method,
        url,
        headers,
        data,
        timeout: config.timeout || 10000
      });

      // Save response to variable
      if (config.responseVariable) {
        await this.setVariable(session, config.responseVariable, response.data);
      }

      await this.logAnalyticsEvent(session, node.id, 'api_call', {
        url,
        method,
        status: response.status
      });

      // Get success path
      const successConnection = (node.connections || []).find(c =>
        c.sourceHandle === 'success' || c.sourceHandle === 'default'
      );

      if (successConnection && successConnection.targetNodeId) {
        return {
          action: 'continue',
          nextNodeId: successConnection.targetNodeId
        };
      }
    } catch (error) {
      console.error('API call error:', error.message);

      await this.logAnalyticsEvent(session, node.id, 'api_call_error', {
        error: error.message
      });

      // Get error path
      const errorConnection = (node.connections || []).find(c =>
        c.sourceHandle === 'error' || c.sourceHandle === 'failure'
      );

      if (errorConnection && errorConnection.targetNodeId) {
        return {
          action: 'continue',
          nextNodeId: errorConnection.targetNodeId
        };
      }
    }

    return { action: 'hangup' };
  }

  /**
   * Handle AI response node
   */
  async handleAIResponse(node, session, input, inputType) {
    const flow = await ivrService.getFlowById(session.flow_id);
    const config = node.config || {};

    try {
      // Get AI service
      const { AIProviderFactory } = require('./ai');

      const aiService = AIProviderFactory.getProvider({
        provider: config.provider || 'openai',
        apiKey: config.apiKey || process.env.OPENAI_API_KEY,
        model: config.model || 'gpt-4o-mini'
      });

      // Build prompt with context
      const systemPrompt = this.interpolateVariables(config.systemPrompt || '', session);
      const userMessage = input || this.interpolateVariables(config.userPrompt || '', session);

      // Get conversation history from session if enabled
      const messages = [{ role: 'system', content: systemPrompt }];

      if (config.useHistory && session.variables?._conversationHistory) {
        messages.push(...session.variables._conversationHistory);
      }

      messages.push({ role: 'user', content: userMessage });

      // Get AI response
      const response = await aiService.chat({
        messages,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 150
      });

      const aiText = response.content;

      // Save response
      if (config.responseVariable) {
        await this.setVariable(session, config.responseVariable, aiText);
      }

      // Update conversation history
      if (config.useHistory) {
        const history = session.variables?._conversationHistory || [];
        history.push({ role: 'user', content: userMessage });
        history.push({ role: 'assistant', content: aiText });
        await this.setVariable(session, '_conversationHistory', history.slice(-10)); // Keep last 10
      }

      await this.logAnalyticsEvent(session, node.id, 'ai_response', {
        inputLength: userMessage.length,
        outputLength: aiText.length
      });

      // Get next node
      const nextNode = await this.getNextNode(node, session);

      return {
        action: 'say',
        text: aiText,
        voice: config.voice || flow.voice,
        nextNodeId: nextNode?.id,
        continue: !!nextNode
      };
    } catch (error) {
      console.error('AI response error:', error.message);

      await this.logAnalyticsEvent(session, node.id, 'ai_error', {
        error: error.message
      });

      return {
        action: 'say',
        text: config.errorMessage || 'I apologize, I could not process your request.',
        voice: flow.voice,
        next: 'hangup'
      };
    }
  }

  /**
   * Handle hangup node
   */
  async handleHangup(node, session, input, inputType) {
    const flow = await ivrService.getFlowById(session.flow_id);
    const config = node.config || {};

    // End session
    await this.endSession(session.call_sid, 'completed');

    const goodbyeMessage = config.message || flow.goodbye_message || 'Goodbye.';

    return {
      action: 'say',
      text: this.interpolateVariables(goodbyeMessage, session),
      voice: flow.voice,
      next: 'hangup'
    };
  }

  /**
   * Handle goto node
   */
  async handleGoto(node, session, input, inputType) {
    const config = node.config || {};
    const targetNodeId = config.targetNodeId;

    if (targetNodeId) {
      return {
        action: 'continue',
        nextNodeId: targetNodeId
      };
    }

    return { action: 'hangup' };
  }

  /**
   * Handle wait node
   */
  async handleWait(node, session, input, inputType) {
    const config = node.config || {};
    const duration = config.duration || 1;

    const nextNode = await this.getNextNode(node, session);

    return {
      action: 'pause',
      length: duration,
      nextNodeId: nextNode?.id,
      continue: !!nextNode
    };
  }

  /**
   * Handle record node
   */
  async handleRecord(node, session, input, inputType) {
    const flow = await ivrService.getFlowById(session.flow_id);
    const config = node.config || {};

    return {
      action: 'record',
      text: config.prompt || 'Please start recording after the beep.',
      voice: flow.voice,
      maxLength: config.maxLength || 60,
      playBeep: config.playBeep !== false,
      finishOnKey: config.finishOnKey || '#',
      transcribe: config.transcribe || false
    };
  }

  /**
   * Handle SMS node
   */
  async handleSMS(node, session, input, inputType) {
    const config = node.config || {};

    try {
      const message = this.interpolateVariables(config.message, session);
      const to = config.to || session.from_number;

      // Send SMS via Twilio
      const TwilioService = require('./voice/TwilioService');
      await TwilioService.sendSMS(to, message, config.from);

      await this.logAnalyticsEvent(session, node.id, 'sms_sent', { to });

      const nextNode = await this.getNextNode(node, session);

      return {
        action: 'continue',
        nextNodeId: nextNode?.id
      };
    } catch (error) {
      console.error('SMS send error:', error.message);
      return { action: 'continue' };
    }
  }

  /**
   * Handle unknown node type
   */
  async handleUnknownNode(node, session) {
    console.error(`Unknown node type: ${node.type}`);
    const nextNode = await this.getNextNode(node, session);

    if (nextNode) {
      return {
        action: 'continue',
        nextNodeId: nextNode.id
      };
    }

    return { action: 'hangup' };
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Create new session
   */
  async createSession(flowId, callSid, callerNumber) {
    const sessionId = uuidv4();

    const session = {
      id: sessionId,
      flow_id: flowId,
      call_sid: callSid,
      from_number: callerNumber,
      to_number: null,
      status: 'in_progress',
      current_node_id: null,
      variables: {},
      input_history: [],
      navigation_path: [],
      started_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('ivr_sessions').insert(session);

    // Cache session
    this.sessionCache.set(callSid, session);

    return session;
  }

  /**
   * Get session by call SID
   */
  async getSession(callSid) {
    // Check cache first
    if (this.sessionCache.has(callSid)) {
      return this.sessionCache.get(callSid);
    }

    const session = await db('ivr_sessions')
      .where({ call_sid: callSid })
      .whereIn('status', ['in_progress', 'active'])
      .first();

    if (session) {
      // Parse JSON fields
      session.variables = typeof session.variables === 'string'
        ? JSON.parse(session.variables)
        : session.variables || {};
      session.input_history = typeof session.input_history === 'string'
        ? JSON.parse(session.input_history)
        : session.input_history || [];
      session.navigation_path = typeof session.navigation_path === 'string'
        ? JSON.parse(session.navigation_path)
        : session.navigation_path || [];

      // Cache it
      this.sessionCache.set(callSid, session);
    }

    return session;
  }

  /**
   * Update session
   */
  async updateSession(callSid, data) {
    const updates = {
      updated_at: new Date()
    };

    if (data.current_node_id !== undefined) updates.current_node_id = data.current_node_id;
    if (data.status !== undefined) updates.status = data.status;
    if (data.variables !== undefined) updates.variables = JSON.stringify(data.variables);
    if (data.input_history !== undefined) updates.input_history = JSON.stringify(data.input_history);
    if (data.navigation_path !== undefined) updates.navigation_path = JSON.stringify(data.navigation_path);

    await db('ivr_sessions').where({ call_sid: callSid }).update(updates);

    // Update cache
    if (this.sessionCache.has(callSid)) {
      const session = this.sessionCache.get(callSid);
      Object.assign(session, data, { updated_at: new Date() });
    }
  }

  /**
   * End session
   */
  async endSession(callSid, reason = 'completed') {
    const session = await this.getSession(callSid);
    if (!session) return;

    const duration = session.started_at
      ? Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)
      : 0;

    await db('ivr_sessions').where({ call_sid: callSid }).update({
      status: reason === 'completed' ? 'completed' : reason,
      end_reason: reason,
      ended_at: new Date(),
      duration_seconds: duration,
      updated_at: new Date()
    });

    // Clear from cache
    this.sessionCache.delete(callSid);

    // Log analytics
    await this.logAnalyticsEvent(session, null, 'session_ended', {
      reason,
      duration
    });
  }

  /**
   * Set session variable
   */
  async setVariable(session, name, value) {
    if (!session.variables) {
      session.variables = {};
    }
    session.variables[name] = value;

    await this.updateSession(session.call_sid, {
      variables: session.variables
    });
  }

  /**
   * Get session variable
   */
  getVariable(session, name) {
    return session.variables?.[name];
  }

  /**
   * Add to input history
   */
  async addToInputHistory(session, entry) {
    if (!session.input_history) {
      session.input_history = [];
    }
    session.input_history.push(entry);

    await this.updateSession(session.call_sid, {
      input_history: session.input_history
    });
  }

  // ==================== NAVIGATION TRACKING ====================

  /**
   * Track node navigation
   */
  async trackNavigation(session, nodeId) {
    if (!session.navigation_path) {
      session.navigation_path = [];
    }

    session.navigation_path.push({
      nodeId,
      timestamp: new Date()
    });

    await this.updateSession(session.call_sid, {
      navigation_path: session.navigation_path
    });
  }

  /**
   * Track menu selection
   */
  async trackMenuSelection(flowId, nodeId, optionKey) {
    const today = new Date().toISOString().split('T')[0];

    // Try to update existing record
    const updated = await db('ivr_menu_stats')
      .where({ node_id: nodeId, option_key: optionKey, date: today })
      .increment('selection_count', 1);

    if (updated === 0) {
      // Insert new record
      await db('ivr_menu_stats').insert({
        id: uuidv4(),
        flow_id: flowId,
        node_id: nodeId,
        option_key: optionKey,
        selection_count: 1,
        date: today,
        created_at: new Date(),
        updated_at: new Date()
      }).onConflict(['node_id', 'option_key', 'date']).merge();
    }
  }

  // ==================== ERROR HANDLING ====================

  /**
   * Handle timeout
   */
  async handleTimeout(session) {
    const flow = await ivrService.getFlowById(session.flow_id);
    const retryCount = session.variables?._retryCount || 0;

    if (retryCount < (flow.max_retries || 3)) {
      await this.setVariable(session, '_retryCount', retryCount + 1);

      return {
        action: 'say',
        text: 'I did not receive any input. Please try again.',
        voice: flow.voice,
        retry: true
      };
    }

    return this.handleMaxRetries(null, session);
  }

  /**
   * Handle max retries exceeded
   */
  async handleMaxRetries(node, session) {
    const flow = await ivrService.getFlowById(session.flow_id);

    await this.logAnalyticsEvent(session, node?.id, 'max_retries_exceeded', {});

    // Check for max_retries connection
    if (node && node.connections) {
      const maxRetriesConnection = node.connections.find(c =>
        c.sourceHandle === 'max_retries' || c.sourceHandle === 'timeout'
      );

      if (maxRetriesConnection && maxRetriesConnection.targetNodeId) {
        return {
          action: 'continue',
          nextNodeId: maxRetriesConnection.targetNodeId
        };
      }
    }

    // Default: end call
    await this.endSession(session.call_sid, 'max_retries');

    return {
      action: 'say',
      text: flow.error_message || 'We could not process your request. Goodbye.',
      voice: flow.voice,
      next: 'hangup'
    };
  }

  /**
   * Generate error response
   */
  generateErrorResponse(session, errorMessage) {
    return {
      action: 'say',
      text: 'An error occurred. Please try again later.',
      next: 'hangup',
      error: errorMessage
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Build menu prompt from options
   */
  buildMenuPrompt(config) {
    if (config.message) return config.message;

    const options = config.options || [];
    let prompt = config.prompt || 'Please select an option: ';

    options.forEach(opt => {
      prompt += `Press ${opt.key || opt.digit} for ${opt.label || opt.description}. `;
    });

    return prompt;
  }

  /**
   * Interpolate variables in string
   */
  interpolateVariables(text, session) {
    if (!text) return '';

    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      // Check session variables
      if (session.variables && session.variables[varName] !== undefined) {
        return session.variables[varName];
      }

      // Check standard variables
      const standardVars = {
        caller: session.from_number,
        callerNumber: session.from_number,
        callSid: session.call_sid,
        sessionId: session.id
      };

      if (standardVars[varName] !== undefined) {
        return standardVars[varName];
      }

      return match; // Keep original if not found
    });
  }

  /**
   * Evaluate single condition
   */
  evaluateSingleCondition(condition, session) {
    const { variable, operator, value } = condition;
    const actualValue = this.getVariable(session, variable);

    switch (operator) {
      case 'equals':
      case '==':
        return actualValue == value;
      case 'not_equals':
      case '!=':
        return actualValue != value;
      case 'contains':
        return String(actualValue).includes(value);
      case 'starts_with':
        return String(actualValue).startsWith(value);
      case 'ends_with':
        return String(actualValue).endsWith(value);
      case 'greater_than':
      case '>':
        return Number(actualValue) > Number(value);
      case 'less_than':
      case '<':
        return Number(actualValue) < Number(value);
      case 'is_empty':
        return !actualValue || actualValue === '';
      case 'is_not_empty':
        return actualValue && actualValue !== '';
      default:
        return false;
    }
  }

  /**
   * Evaluate condition node
   */
  evaluateCondition(node, session) {
    const config = node.config || {};
    const conditions = config.conditions || [];

    for (const condition of conditions) {
      if (this.evaluateSingleCondition(condition, session)) {
        return (node.connections || []).find(c => c.sourceHandle === condition.id);
      }
    }

    return (node.connections || []).find(c => c.sourceHandle === 'else');
  }

  /**
   * Evaluate expression
   */
  evaluateExpression(expression, session) {
    // Simple expression evaluation
    // Replace variables first
    let result = this.interpolateVariables(expression, session);

    // Try to evaluate as math if it looks like math
    if (/^[\d\s+\-*/().]+$/.test(result)) {
      try {
        result = eval(result);
      } catch (e) {
        // Keep as string
      }
    }

    return result;
  }

  /**
   * Log analytics event
   */
  async logAnalyticsEvent(session, nodeId, eventType, eventData = {}) {
    try {
      await db('ivr_analytics').insert({
        id: uuidv4(),
        flow_id: session.flow_id,
        session_id: session.id,
        node_id: nodeId,
        event_type: eventType,
        event_data: JSON.stringify(eventData),
        created_at: new Date()
      });
    } catch (error) {
      console.error('Error logging IVR analytics:', error.message);
    }
  }
}

module.exports = new IVRExecutorService();

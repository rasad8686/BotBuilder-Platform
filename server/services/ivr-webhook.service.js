/**
 * IVR Webhook Service
 * Handles Twilio IVR webhook callbacks
 */

const twilio = require('twilio');
const { VoiceResponse } = twilio.twiml;
const db = require('../config/db');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class IVRWebhookService {
  constructor() {
    this.maxRetries = 3;
    this.defaultTimeout = 5;
    this.defaultLanguage = 'en-US';
  }

  /**
   * Handle incoming call
   */
  async handleIncomingCall(params) {
    const {
      CallSid,
      From,
      To,
      CallStatus,
      Direction,
      CallerCity,
      CallerState,
      CallerCountry,
      CallerZip
    } = params;

    logger.info('Incoming call received', { CallSid, From, To });

    try {
      // Find IVR flow associated with this phone number
      const phoneNumber = await db('phone_numbers')
        .where({ phone_number: To, status: 'active' })
        .first();

      if (!phoneNumber) {
        logger.warn('No phone number found for incoming call', { To });
        return this.generateErrorResponse('This number is not configured');
      }

      // Get the IVR flow
      const ivrFlow = await db('ivr_flows')
        .where({ id: phoneNumber.ivr_flow_id, status: 'active' })
        .first();

      if (!ivrFlow) {
        logger.warn('No active IVR flow found', { phoneNumberId: phoneNumber.id });
        return this.generateErrorResponse('No IVR flow configured');
      }

      // Create call session
      const session = await this.createCallSession({
        callSid: CallSid,
        from: From,
        to: To,
        direction: Direction || 'inbound',
        status: CallStatus,
        ivrFlowId: ivrFlow.id,
        organizationId: phoneNumber.organization_id,
        callerInfo: {
          city: CallerCity,
          state: CallerState,
          country: CallerCountry,
          zip: CallerZip
        }
      });

      // Log analytics
      await this.logAnalytics({
        sessionId: session.id,
        event: 'call_started',
        data: { CallSid, From, To, Direction }
      });

      // Parse flow and get initial node
      const flowData = typeof ivrFlow.flow_data === 'string'
        ? JSON.parse(ivrFlow.flow_data)
        : ivrFlow.flow_data;

      const startNode = this.findStartNode(flowData);

      if (!startNode) {
        logger.error('No start node found in IVR flow', { ivrFlowId: ivrFlow.id });
        return this.generateErrorResponse('IVR flow configuration error');
      }

      // Update session with current node
      await this.updateSession(session.id, { current_node_id: startNode.id });

      // Execute start node and generate TwiML
      return this.executeNode(startNode, flowData, session.id);

    } catch (error) {
      logger.error('Error handling incoming call:', error);
      return this.generateErrorResponse('An error occurred. Please try again later.');
    }
  }

  /**
   * Handle gather input (DTMF or speech)
   */
  async handleGatherInput(params) {
    const {
      CallSid,
      Digits,
      SpeechResult,
      Confidence,
      SessionId
    } = params;

    const input = Digits || SpeechResult;
    const inputType = Digits ? 'dtmf' : 'speech';

    logger.info('Gather input received', { CallSid, input, inputType, Confidence });

    try {
      // Get session
      const session = await this.getSessionByCallSid(CallSid);

      if (!session) {
        logger.warn('Session not found for gather input', { CallSid });
        return this.generateErrorResponse('Session expired');
      }

      // Get IVR flow
      const ivrFlow = await db('ivr_flows')
        .where({ id: session.ivr_flow_id })
        .first();

      if (!ivrFlow) {
        return this.generateErrorResponse('Flow not found');
      }

      const flowData = typeof ivrFlow.flow_data === 'string'
        ? JSON.parse(ivrFlow.flow_data)
        : ivrFlow.flow_data;

      // Get current node
      const currentNode = this.findNodeById(flowData, session.current_node_id);

      if (!currentNode) {
        return this.generateErrorResponse('Node not found');
      }

      // Log input
      await this.logAnalytics({
        sessionId: session.id,
        event: 'user_input',
        data: { input, inputType, confidence: Confidence, nodeId: currentNode.id }
      });

      // Update session variables
      const sessionVars = session.variables || {};
      sessionVars.lastInput = input;
      sessionVars.lastInputType = inputType;

      if (currentNode.data?.variableName) {
        sessionVars[currentNode.data.variableName] = input;
      }

      await this.updateSession(session.id, { variables: sessionVars });

      // Find matching route
      const nextNode = this.findNextNode(currentNode, input, flowData);

      if (!nextNode) {
        // Handle invalid input with retry
        const retryCount = session.retry_count || 0;

        if (retryCount < this.maxRetries) {
          await this.updateSession(session.id, { retry_count: retryCount + 1 });

          const invalidMessage = currentNode.data?.invalidInputMessage || 'Invalid input. Please try again.';
          return this.generateRetryResponse(currentNode, invalidMessage, flowData, session.id);
        } else {
          // Max retries reached
          const maxRetriesNode = this.findMaxRetriesNode(currentNode, flowData);
          if (maxRetriesNode) {
            await this.updateSession(session.id, { current_node_id: maxRetriesNode.id, retry_count: 0 });
            return this.executeNode(maxRetriesNode, flowData, session.id);
          }
          return this.generateErrorResponse('Maximum retry attempts reached. Goodbye.');
        }
      }

      // Reset retry count and update current node
      await this.updateSession(session.id, {
        current_node_id: nextNode.id,
        retry_count: 0
      });

      // Execute next node
      return this.executeNode(nextNode, flowData, session.id);

    } catch (error) {
      logger.error('Error handling gather input:', error);
      return this.generateErrorResponse('An error occurred');
    }
  }

  /**
   * Handle recording callback
   */
  async handleRecording(params) {
    const {
      CallSid,
      RecordingSid,
      RecordingUrl,
      RecordingDuration,
      RecordingStatus
    } = params;

    logger.info('Recording callback received', { CallSid, RecordingSid, RecordingStatus });

    try {
      const session = await this.getSessionByCallSid(CallSid);

      if (!session) {
        logger.warn('Session not found for recording', { CallSid });
        return { success: false, error: 'Session not found' };
      }

      // Store recording info
      const recording = await db('ivr_recordings').insert({
        id: uuidv4(),
        session_id: session.id,
        recording_sid: RecordingSid,
        recording_url: RecordingUrl,
        duration: parseInt(RecordingDuration) || 0,
        status: RecordingStatus,
        organization_id: session.organization_id,
        created_at: new Date()
      }).returning('*');

      // Update session with recording
      const recordings = session.recordings || [];
      recordings.push({
        id: recording[0].id,
        sid: RecordingSid,
        url: RecordingUrl,
        duration: RecordingDuration
      });

      await this.updateSession(session.id, { recordings });

      // Log analytics
      await this.logAnalytics({
        sessionId: session.id,
        event: 'recording_completed',
        data: { RecordingSid, duration: RecordingDuration }
      });

      // Optionally start transcription
      if (process.env.TWILIO_TRANSCRIPTION_ENABLED === 'true') {
        await this.requestTranscription(RecordingSid);
      }

      return { success: true, recordingId: recording[0].id };

    } catch (error) {
      logger.error('Error handling recording:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle transcription callback
   */
  async handleTranscription(params) {
    const {
      CallSid,
      RecordingSid,
      TranscriptionSid,
      TranscriptionText,
      TranscriptionStatus
    } = params;

    logger.info('Transcription callback received', { CallSid, TranscriptionSid, TranscriptionStatus });

    try {
      // Find recording
      const recording = await db('ivr_recordings')
        .where({ recording_sid: RecordingSid })
        .first();

      if (!recording) {
        logger.warn('Recording not found for transcription', { RecordingSid });
        return { success: false, error: 'Recording not found' };
      }

      // Update recording with transcription
      await db('ivr_recordings')
        .where({ id: recording.id })
        .update({
          transcription_sid: TranscriptionSid,
          transcription_text: TranscriptionText,
          transcription_status: TranscriptionStatus,
          updated_at: new Date()
        });

      // Update session variable if configured
      const session = await db('ivr_sessions')
        .where({ id: recording.session_id })
        .first();

      if (session) {
        const variables = session.variables || {};
        variables.lastTranscription = TranscriptionText;
        await this.updateSession(session.id, { variables });

        await this.logAnalytics({
          sessionId: session.id,
          event: 'transcription_completed',
          data: { TranscriptionSid, text: TranscriptionText }
        });
      }

      return { success: true };

    } catch (error) {
      logger.error('Error handling transcription:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle call status callback
   */
  async handleCallStatus(params) {
    const {
      CallSid,
      CallStatus,
      CallDuration,
      Timestamp,
      ErrorCode,
      ErrorMessage
    } = params;

    logger.info('Call status callback', { CallSid, CallStatus, CallDuration });

    try {
      const session = await this.getSessionByCallSid(CallSid);

      if (!session) {
        logger.warn('Session not found for status update', { CallSid });
        return { success: false, error: 'Session not found' };
      }

      const updates = {
        status: CallStatus,
        updated_at: new Date()
      };

      // Handle call completion
      if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(CallStatus)) {
        updates.ended_at = new Date();
        updates.duration = parseInt(CallDuration) || 0;

        if (ErrorCode) {
          updates.error_code = ErrorCode;
          updates.error_message = ErrorMessage;
        }
      }

      await this.updateSession(session.id, updates);

      // Log analytics
      await this.logAnalytics({
        sessionId: session.id,
        event: `call_${CallStatus}`,
        data: {
          duration: CallDuration,
          errorCode: ErrorCode,
          errorMessage: ErrorMessage
        }
      });

      // Update phone number statistics
      if (CallStatus === 'completed') {
        await db('phone_numbers')
          .where({ phone_number: session.to_number })
          .increment('total_calls', 1);
      }

      return { success: true };

    } catch (error) {
      logger.error('Error handling call status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle dial status callback
   */
  async handleDialStatus(params) {
    const {
      CallSid,
      DialCallSid,
      DialCallStatus,
      DialCallDuration,
      DialBridged,
      QueueResult,
      QueueTime
    } = params;

    logger.info('Dial status callback', { CallSid, DialCallStatus, DialBridged });

    try {
      const session = await this.getSessionByCallSid(CallSid);

      if (!session) {
        return this.generateErrorResponse('Session not found');
      }

      // Log dial result
      await this.logAnalytics({
        sessionId: session.id,
        event: 'dial_completed',
        data: {
          dialCallSid: DialCallSid,
          dialStatus: DialCallStatus,
          duration: DialCallDuration,
          bridged: DialBridged,
          queueResult: QueueResult,
          queueTime: QueueTime
        }
      });

      // Get flow and current node
      const ivrFlow = await db('ivr_flows')
        .where({ id: session.ivr_flow_id })
        .first();

      if (!ivrFlow) {
        return this.generateErrorResponse('Flow not found');
      }

      const flowData = typeof ivrFlow.flow_data === 'string'
        ? JSON.parse(ivrFlow.flow_data)
        : ivrFlow.flow_data;

      const currentNode = this.findNodeById(flowData, session.current_node_id);

      // Find appropriate next node based on dial result
      let nextNodeId = null;

      if (DialCallStatus === 'completed' && DialBridged === 'true') {
        nextNodeId = currentNode?.data?.onSuccess;
      } else if (DialCallStatus === 'busy') {
        nextNodeId = currentNode?.data?.onBusy;
      } else if (DialCallStatus === 'no-answer') {
        nextNodeId = currentNode?.data?.onNoAnswer;
      } else {
        nextNodeId = currentNode?.data?.onFailed;
      }

      if (nextNodeId) {
        const nextNode = this.findNodeById(flowData, nextNodeId);
        if (nextNode) {
          await this.updateSession(session.id, { current_node_id: nextNode.id });
          return this.executeNode(nextNode, flowData, session.id);
        }
      }

      // Default: end call
      const response = new VoiceResponse();
      response.say({ voice: 'alice' }, 'Goodbye.');
      response.hangup();
      return response.toString();

    } catch (error) {
      logger.error('Error handling dial status:', error);
      return this.generateErrorResponse('An error occurred');
    }
  }

  /**
   * Execute an IVR node and generate TwiML
   */
  async executeNode(node, flowData, sessionId) {
    const response = new VoiceResponse();
    const nodeData = node.data || {};

    logger.info('Executing node', { nodeId: node.id, nodeType: node.type });

    try {
      switch (node.type) {
        case 'welcome':
        case 'say':
        case 'message':
          await this.executeSayNode(response, nodeData, node, flowData, sessionId);
          break;

        case 'menu':
        case 'gather':
          await this.executeGatherNode(response, nodeData, node, flowData, sessionId);
          break;

        case 'transfer':
        case 'dial':
          await this.executeDialNode(response, nodeData, node, sessionId);
          break;

        case 'queue':
          await this.executeQueueNode(response, nodeData, node, sessionId);
          break;

        case 'record':
          await this.executeRecordNode(response, nodeData, node, sessionId);
          break;

        case 'voicemail':
          await this.executeVoicemailNode(response, nodeData, node, sessionId);
          break;

        case 'hours':
        case 'businessHours':
          return await this.executeBusinessHoursNode(node, flowData, sessionId);

        case 'condition':
        case 'branch':
          return await this.executeConditionNode(node, flowData, sessionId);

        case 'setVariable':
          return await this.executeSetVariableNode(node, flowData, sessionId);

        case 'httpRequest':
        case 'webhook':
          return await this.executeWebhookNode(node, flowData, sessionId);

        case 'hangup':
        case 'end':
          response.say({ voice: nodeData.voice || 'alice' }, nodeData.message || 'Goodbye.');
          response.hangup();
          break;

        default:
          logger.warn('Unknown node type', { nodeType: node.type });
          // Try to continue to next node
          const nextNode = this.findDefaultNextNode(node, flowData);
          if (nextNode) {
            return this.executeNode(nextNode, flowData, sessionId);
          }
          response.say({ voice: 'alice' }, 'An error occurred.');
          response.hangup();
      }

      return response.toString();

    } catch (error) {
      logger.error('Error executing node:', error);
      response.say({ voice: 'alice' }, 'An error occurred. Please try again.');
      response.hangup();
      return response.toString();
    }
  }

  /**
   * Execute Say node
   */
  async executeSayNode(response, nodeData, node, flowData, sessionId) {
    const message = await this.interpolateVariables(nodeData.message || nodeData.text || '', sessionId);
    const voice = nodeData.voice || 'alice';
    const language = nodeData.language || this.defaultLanguage;

    if (nodeData.audioUrl) {
      response.play(nodeData.audioUrl);
    } else {
      response.say({ voice, language }, message);
    }

    // Check for next node
    const nextNode = this.findDefaultNextNode(node, flowData);
    if (nextNode) {
      await this.updateSession(sessionId, { current_node_id: nextNode.id });

      // If next node is also a say node, chain them
      if (['say', 'message', 'welcome'].includes(nextNode.type)) {
        await this.executeSayNode(response, nextNode.data || {}, nextNode, flowData, sessionId);
      } else {
        // Generate redirect to continue flow
        const twiml = await this.executeNode(nextNode, flowData, sessionId);
        // Append the TwiML
        response.append(twiml);
      }
    }
  }

  /**
   * Execute Gather node (menu)
   */
  async executeGatherNode(response, nodeData, node, flowData, sessionId) {
    const message = await this.interpolateVariables(nodeData.message || nodeData.prompt || '', sessionId);
    const voice = nodeData.voice || 'alice';
    const language = nodeData.language || this.defaultLanguage;
    const timeout = nodeData.timeout || this.defaultTimeout;
    const numDigits = nodeData.numDigits || nodeData.maxDigits;
    const finishOnKey = nodeData.finishOnKey || '#';
    const inputType = nodeData.inputType || 'dtmf';

    const gatherOptions = {
      action: `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/gather?SessionId=${sessionId}`,
      method: 'POST',
      timeout,
      finishOnKey
    };

    if (numDigits) {
      gatherOptions.numDigits = numDigits;
    }

    // Input type
    if (inputType === 'speech') {
      gatherOptions.input = 'speech';
      gatherOptions.speechTimeout = nodeData.speechTimeout || 'auto';
      gatherOptions.language = language;
    } else if (inputType === 'both') {
      gatherOptions.input = 'dtmf speech';
      gatherOptions.speechTimeout = nodeData.speechTimeout || 'auto';
      gatherOptions.language = language;
    } else {
      gatherOptions.input = 'dtmf';
    }

    const gather = response.gather(gatherOptions);

    if (nodeData.audioUrl) {
      gather.play(nodeData.audioUrl);
    } else if (message) {
      gather.say({ voice, language }, message);
    }

    // Add no-input handler
    const noInputMessage = nodeData.noInputMessage || 'We didn\'t receive any input.';
    response.say({ voice, language }, noInputMessage);
    response.redirect(`${process.env.BASE_URL || ''}/api/voice/ivr/webhook/gather?SessionId=${sessionId}&NoInput=true`);
  }

  /**
   * Execute Dial node (transfer)
   */
  async executeDialNode(response, nodeData, node, sessionId) {
    const callerId = nodeData.callerId || process.env.TWILIO_PHONE_NUMBER;
    const timeout = nodeData.timeout || 30;
    const record = nodeData.record || false;

    const dialOptions = {
      callerId,
      timeout,
      action: `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/dial-status?SessionId=${sessionId}`,
      method: 'POST'
    };

    if (record) {
      dialOptions.record = 'record-from-answer-dual';
      dialOptions.recordingStatusCallback = `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/record`;
    }

    // Play hold music or message before connecting
    if (nodeData.holdMessage) {
      response.say({ voice: nodeData.voice || 'alice' }, nodeData.holdMessage);
    }

    const dial = response.dial(dialOptions);

    // Handle different dial targets
    if (nodeData.number || nodeData.phoneNumber) {
      dial.number(nodeData.number || nodeData.phoneNumber);
    } else if (nodeData.sipUri) {
      dial.sip(nodeData.sipUri);
    } else if (nodeData.client) {
      dial.client(nodeData.client);
    } else if (nodeData.queue) {
      dial.queue(nodeData.queue);
    }
  }

  /**
   * Execute Queue node
   */
  async executeQueueNode(response, nodeData, node, sessionId) {
    const queueName = nodeData.queueName || 'default';
    const waitUrl = nodeData.waitUrl || nodeData.holdMusicUrl;

    const enqueueOptions = {
      action: `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/dial-status?SessionId=${sessionId}`,
      method: 'POST',
      waitUrl: waitUrl || '/api/voice/ivr/hold-music',
      waitUrlMethod: 'POST'
    };

    if (nodeData.waitMessage) {
      response.say({ voice: nodeData.voice || 'alice' }, nodeData.waitMessage);
    }

    response.enqueue(enqueueOptions, queueName);
  }

  /**
   * Execute Record node
   */
  async executeRecordNode(response, nodeData, node, sessionId) {
    const message = nodeData.message || 'Please leave a message after the beep.';
    const voice = nodeData.voice || 'alice';
    const maxLength = nodeData.maxLength || 120;
    const finishOnKey = nodeData.finishOnKey || '#';
    const playBeep = nodeData.playBeep !== false;
    const transcribe = nodeData.transcribe || false;

    response.say({ voice }, message);

    const recordOptions = {
      action: `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/gather?SessionId=${sessionId}`,
      method: 'POST',
      maxLength,
      finishOnKey,
      playBeep,
      recordingStatusCallback: `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/record?SessionId=${sessionId}`,
      recordingStatusCallbackMethod: 'POST'
    };

    if (transcribe) {
      recordOptions.transcribe = true;
      recordOptions.transcribeCallback = `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/transcription?SessionId=${sessionId}`;
    }

    response.record(recordOptions);
  }

  /**
   * Execute Voicemail node
   */
  async executeVoicemailNode(response, nodeData, node, sessionId) {
    const message = nodeData.message || 'Please leave a message after the beep. Press pound when finished.';
    const voice = nodeData.voice || 'alice';

    response.say({ voice }, message);

    response.record({
      action: `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/gather?SessionId=${sessionId}`,
      method: 'POST',
      maxLength: nodeData.maxLength || 180,
      finishOnKey: '#',
      playBeep: true,
      transcribe: true,
      transcribeCallback: `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/transcription?SessionId=${sessionId}`,
      recordingStatusCallback: `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/record?SessionId=${sessionId}`
    });

    response.say({ voice }, 'Thank you for your message. Goodbye.');
    response.hangup();
  }

  /**
   * Execute Business Hours node
   */
  async executeBusinessHoursNode(node, flowData, sessionId) {
    const nodeData = node.data || {};
    const schedule = nodeData.schedule || {};
    const timezone = nodeData.timezone || 'UTC';

    const isOpen = this.checkBusinessHours(schedule, timezone);

    const nextNodeId = isOpen ? nodeData.openNodeId : nodeData.closedNodeId;
    const nextNode = nextNodeId ? this.findNodeById(flowData, nextNodeId) : null;

    if (nextNode) {
      await this.updateSession(sessionId, { current_node_id: nextNode.id });
      return this.executeNode(nextNode, flowData, sessionId);
    }

    const response = new VoiceResponse();
    if (!isOpen) {
      response.say({ voice: 'alice' }, nodeData.closedMessage || 'We are currently closed. Please call back during business hours.');
    }
    response.hangup();
    return response.toString();
  }

  /**
   * Execute Condition node
   */
  async executeConditionNode(node, flowData, sessionId) {
    const nodeData = node.data || {};
    const session = await db('ivr_sessions').where({ id: sessionId }).first();
    const variables = session?.variables || {};

    let result = false;

    try {
      const leftValue = this.resolveVariable(nodeData.leftOperand, variables);
      const rightValue = nodeData.rightOperand;
      const operator = nodeData.operator || '==';

      switch (operator) {
        case '==':
        case 'equals':
          result = leftValue == rightValue;
          break;
        case '!=':
        case 'notEquals':
          result = leftValue != rightValue;
          break;
        case '>':
          result = parseFloat(leftValue) > parseFloat(rightValue);
          break;
        case '<':
          result = parseFloat(leftValue) < parseFloat(rightValue);
          break;
        case '>=':
          result = parseFloat(leftValue) >= parseFloat(rightValue);
          break;
        case '<=':
          result = parseFloat(leftValue) <= parseFloat(rightValue);
          break;
        case 'contains':
          result = String(leftValue).includes(String(rightValue));
          break;
        case 'startsWith':
          result = String(leftValue).startsWith(String(rightValue));
          break;
        case 'endsWith':
          result = String(leftValue).endsWith(String(rightValue));
          break;
      }
    } catch (e) {
      logger.error('Error evaluating condition:', e);
    }

    const nextNodeId = result ? nodeData.trueNodeId : nodeData.falseNodeId;
    const nextNode = nextNodeId ? this.findNodeById(flowData, nextNodeId) : null;

    if (nextNode) {
      await this.updateSession(sessionId, { current_node_id: nextNode.id });
      return this.executeNode(nextNode, flowData, sessionId);
    }

    const response = new VoiceResponse();
    response.hangup();
    return response.toString();
  }

  /**
   * Execute Set Variable node
   */
  async executeSetVariableNode(node, flowData, sessionId) {
    const nodeData = node.data || {};
    const session = await db('ivr_sessions').where({ id: sessionId }).first();
    const variables = session?.variables || {};

    variables[nodeData.variableName] = nodeData.value;

    await this.updateSession(sessionId, { variables });

    const nextNode = this.findDefaultNextNode(node, flowData);
    if (nextNode) {
      await this.updateSession(sessionId, { current_node_id: nextNode.id });
      return this.executeNode(nextNode, flowData, sessionId);
    }

    const response = new VoiceResponse();
    response.hangup();
    return response.toString();
  }

  /**
   * Execute Webhook node
   */
  async executeWebhookNode(node, flowData, sessionId) {
    const nodeData = node.data || {};
    const session = await db('ivr_sessions').where({ id: sessionId }).first();
    const variables = session?.variables || {};

    try {
      const url = await this.interpolateVariables(nodeData.url, sessionId);
      const method = nodeData.method || 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(nodeData.headers || {})
        },
        body: method !== 'GET' ? JSON.stringify({
          sessionId,
          callSid: session.call_sid,
          from: session.from_number,
          to: session.to_number,
          variables,
          ...(nodeData.body || {})
        }) : undefined
      });

      const data = await response.json();

      // Store response in variables
      if (nodeData.responseVariable) {
        variables[nodeData.responseVariable] = data;
        await this.updateSession(sessionId, { variables });
      }

    } catch (error) {
      logger.error('Webhook node error:', error);
    }

    const nextNode = this.findDefaultNextNode(node, flowData);
    if (nextNode) {
      await this.updateSession(sessionId, { current_node_id: nextNode.id });
      return this.executeNode(nextNode, flowData, sessionId);
    }

    const twiml = new VoiceResponse();
    twiml.hangup();
    return twiml.toString();
  }

  // Helper methods

  async createCallSession(data) {
    const [session] = await db('ivr_sessions').insert({
      id: uuidv4(),
      call_sid: data.callSid,
      from_number: data.from,
      to_number: data.to,
      direction: data.direction,
      status: data.status,
      ivr_flow_id: data.ivrFlowId,
      organization_id: data.organizationId,
      caller_info: JSON.stringify(data.callerInfo),
      variables: JSON.stringify({}),
      started_at: new Date(),
      created_at: new Date()
    }).returning('*');

    return session;
  }

  async getSessionByCallSid(callSid) {
    return db('ivr_sessions').where({ call_sid: callSid }).first();
  }

  async updateSession(sessionId, updates) {
    if (updates.variables && typeof updates.variables === 'object') {
      updates.variables = JSON.stringify(updates.variables);
    }
    if (updates.recordings && typeof updates.recordings === 'object') {
      updates.recordings = JSON.stringify(updates.recordings);
    }

    updates.updated_at = new Date();

    return db('ivr_sessions').where({ id: sessionId }).update(updates);
  }

  async logAnalytics(data) {
    try {
      await db('ivr_analytics').insert({
        id: uuidv4(),
        session_id: data.sessionId,
        event: data.event,
        data: JSON.stringify(data.data || {}),
        created_at: new Date()
      });
    } catch (error) {
      logger.error('Error logging analytics:', error);
    }
  }

  findStartNode(flowData) {
    const nodes = flowData.nodes || flowData;
    if (Array.isArray(nodes)) {
      return nodes.find(n => n.type === 'start' || n.type === 'welcome' || n.data?.isStart);
    }
    return null;
  }

  findNodeById(flowData, nodeId) {
    const nodes = flowData.nodes || flowData;
    if (Array.isArray(nodes)) {
      return nodes.find(n => n.id === nodeId);
    }
    return null;
  }

  findNextNode(currentNode, input, flowData) {
    const edges = flowData.edges || [];
    const nodes = flowData.nodes || flowData;

    // Check for explicit routes based on input
    if (currentNode.data?.routes) {
      const route = currentNode.data.routes.find(r =>
        r.value === input ||
        r.pattern === input ||
        (r.values && r.values.includes(input))
      );
      if (route && route.targetNodeId) {
        return this.findNodeById(flowData, route.targetNodeId);
      }
    }

    // Check edges
    const matchingEdge = edges.find(e =>
      e.source === currentNode.id &&
      (e.sourceHandle === input || e.label === input || !e.sourceHandle)
    );

    if (matchingEdge) {
      return this.findNodeById(flowData, matchingEdge.target);
    }

    return null;
  }

  findDefaultNextNode(node, flowData) {
    const edges = flowData.edges || [];
    const defaultEdge = edges.find(e =>
      e.source === node.id &&
      (!e.sourceHandle || e.sourceHandle === 'default' || e.sourceHandle === 'next')
    );

    if (defaultEdge) {
      return this.findNodeById(flowData, defaultEdge.target);
    }

    // Check node data for next node
    if (node.data?.nextNodeId) {
      return this.findNodeById(flowData, node.data.nextNodeId);
    }

    return null;
  }

  findMaxRetriesNode(node, flowData) {
    const edges = flowData.edges || [];
    const maxRetriesEdge = edges.find(e =>
      e.source === node.id &&
      (e.sourceHandle === 'maxRetries' || e.label === 'maxRetries')
    );

    if (maxRetriesEdge) {
      return this.findNodeById(flowData, maxRetriesEdge.target);
    }

    if (node.data?.maxRetriesNodeId) {
      return this.findNodeById(flowData, node.data.maxRetriesNodeId);
    }

    return null;
  }

  async interpolateVariables(text, sessionId) {
    if (!text) return text;

    const session = await db('ivr_sessions').where({ id: sessionId }).first();
    const variables = session?.variables ? (typeof session.variables === 'string' ? JSON.parse(session.variables) : session.variables) : {};

    // Add default variables
    variables.callerNumber = session?.from_number;
    variables.calledNumber = session?.to_number;
    variables.callSid = session?.call_sid;

    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? variables[varName] : match;
    });
  }

  resolveVariable(expression, variables) {
    if (expression.startsWith('{{') && expression.endsWith('}}')) {
      const varName = expression.slice(2, -2);
      return variables[varName];
    }
    return expression;
  }

  checkBusinessHours(schedule, timezone) {
    const now = new Date();
    const options = { timeZone: timezone, weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: false };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);

    const dayOfWeek = parts.find(p => p.type === 'weekday')?.value.toLowerCase();
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const currentTime = hour * 60 + minute;

    const todaySchedule = schedule[dayOfWeek];
    if (!todaySchedule || !todaySchedule.open) {
      return false;
    }

    const [openHour, openMinute] = (todaySchedule.start || '09:00').split(':').map(Number);
    const [closeHour, closeMinute] = (todaySchedule.end || '17:00').split(':').map(Number);

    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;

    return currentTime >= openTime && currentTime <= closeTime;
  }

  generateErrorResponse(message) {
    const response = new VoiceResponse();
    response.say({ voice: 'alice' }, message);
    response.hangup();
    return response.toString();
  }

  generateRetryResponse(node, message, flowData, sessionId) {
    const response = new VoiceResponse();
    const nodeData = node.data || {};

    response.say({ voice: nodeData.voice || 'alice' }, message);

    // Re-gather input
    const gatherOptions = {
      action: `${process.env.BASE_URL || ''}/api/voice/ivr/webhook/gather?SessionId=${sessionId}`,
      method: 'POST',
      timeout: nodeData.timeout || this.defaultTimeout,
      input: nodeData.inputType === 'speech' ? 'speech' : 'dtmf'
    };

    if (nodeData.numDigits) {
      gatherOptions.numDigits = nodeData.numDigits;
    }

    const gather = response.gather(gatherOptions);

    if (nodeData.message) {
      gather.say({ voice: nodeData.voice || 'alice' }, nodeData.message);
    }

    return response.toString();
  }

  async requestTranscription(recordingSid) {
    // Transcription is automatically handled by Twilio when transcribe=true
    // This method can be used for custom transcription services
    logger.info('Transcription requested for recording', { recordingSid });
  }
}

module.exports = new IVRWebhookService();

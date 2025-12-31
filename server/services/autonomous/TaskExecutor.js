/**
 * Task Executor for Autonomous Agents
 * Enhanced with multi-step task planning, error recovery, and memory management
 */

const db = require('../../db');
const log = require('../../utils/logger');
const AgentCore = require('./AgentCore');
const toolRegistry = require('./ToolRegistry');

// Task planner configuration
const TASK_PLANNER_CONFIG = {
  maxSteps: parseInt(process.env.AGENT_MAX_STEPS) || 20,
  maxRetries: parseInt(process.env.AGENT_MAX_RETRIES) || 3,
  retryDelayMs: parseInt(process.env.AGENT_RETRY_DELAY_MS) || 1000,
  contextWindowSize: parseInt(process.env.AGENT_CONTEXT_WINDOW) || 10,
  enableMemoryPersistence: process.env.AGENT_MEMORY_PERSISTENCE === 'true'
};

class TaskExecutor {
  constructor(agent) {
    this.agent = agent;

    // Enhanced context with memory management
    this.context = {
      notes: {},
      history: [],
      shortTermMemory: [], // Recent interactions
      longTermMemory: new Map(), // Persistent key-value store
      workingMemory: {}, // Current task state
      toolLogs: [] // Tool execution logs
    };

    // Task planning state
    this.currentPlan = null;
    this.planRevisions = 0;
    this.maxPlanRevisions = 3;

    // Error recovery state
    this.errorHistory = [];
    this.recoveryStrategies = new Map();

    // Initialize default recovery strategies
    this.initializeRecoveryStrategies();
  }

  /**
   * Initialize default error recovery strategies
   */
  initializeRecoveryStrategies() {
    // Network error recovery
    this.recoveryStrategies.set('NETWORK_ERROR', async (error, step) => {
      log.info('Applying NETWORK_ERROR recovery strategy');
      await this.delay(2000);
      return { action: 'retry', message: 'Retrying after network delay' };
    });

    // Rate limit recovery
    this.recoveryStrategies.set('RATE_LIMIT', async (error, step) => {
      log.info('Applying RATE_LIMIT recovery strategy');
      const waitTime = this.extractWaitTime(error) || 60000;
      await this.delay(waitTime);
      return { action: 'retry', message: `Waited ${waitTime}ms for rate limit` };
    });

    // Resource not found recovery
    this.recoveryStrategies.set('NOT_FOUND', async (error, step) => {
      log.info('Applying NOT_FOUND recovery strategy');
      return { action: 'skip', message: 'Skipping step - resource not found' };
    });

    // Authentication error recovery
    this.recoveryStrategies.set('AUTH_ERROR', async (error, step) => {
      log.info('Applying AUTH_ERROR recovery strategy');
      return { action: 'abort', message: 'Authentication required - aborting task' };
    });

    // Generic error recovery
    this.recoveryStrategies.set('GENERIC', async (error, step) => {
      log.info('Applying GENERIC recovery strategy');
      return { action: 'retry', message: 'Retrying with generic recovery' };
    });
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(errorType, handler) {
    this.recoveryStrategies.set(errorType, handler);
  }

  /**
   * Classify error type for recovery
   */
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('network') || message.includes('econnrefused') || message.includes('timeout')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
      return 'RATE_LIMIT';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND';
    }
    if (message.includes('unauthorized') || message.includes('401') || message.includes('403')) {
      return 'AUTH_ERROR';
    }

    return 'GENERIC';
  }

  /**
   * Extract wait time from rate limit error
   */
  extractWaitTime(error) {
    const match = error.message?.match(/retry after (\d+)/i);
    return match ? parseInt(match[1]) * 1000 : null;
  }

  /**
   * Create a new task
   */
  static async createTask(agentId, taskDescription, inputData = {}) {
    const result = await db.query(
      `INSERT INTO agent_tasks
       (agent_id, task_description, input_data, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [agentId, taskDescription, JSON.stringify(inputData)]
    );

    log.info('TaskExecutor: Task created', { taskId: result.rows[0].id, agentId });
    return TaskExecutor.parseTask(result.rows[0]);
  }

  /**
   * Get task by ID
   */
  static async getTask(taskId) {
    const result = await db.query(
      `SELECT * FROM agent_tasks WHERE id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return TaskExecutor.parseTask(result.rows[0]);
  }

  /**
   * Get tasks for an agent
   */
  static async getTasksByAgent(agentId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let query = `SELECT * FROM agent_tasks WHERE agent_id = $1`;
    const params = [agentId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows.map(TaskExecutor.parseTask);
  }

  /**
   * Get steps for a task
   */
  static async getTaskSteps(taskId) {
    const result = await db.query(
      `SELECT * FROM task_steps WHERE task_id = $1 ORDER BY step_number ASC`,
      [taskId]
    );
    return result.rows.map(TaskExecutor.parseStep);
  }

  /**
   * Execute a task
   */
  async execute(taskId) {
    const task = await TaskExecutor.getTask(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Update task status to running
    await this.updateTaskStatus(taskId, 'running');

    try {
      log.info('TaskExecutor: Starting task execution', { taskId, agentId: this.agent.id });

      // Step 1: Think and Plan
      const plan = await this.thinkAndPlan(taskId, task.task_description, task.input_data);

      // Step 2: Execute plan steps
      const results = await this.executePlan(taskId, plan);

      // Step 3: Compile final result
      const finalResult = await this.compileResult(taskId, task.task_description, results);

      // Update task as completed
      await this.completeTask(taskId, finalResult);
      await AgentCore.updateStats(this.agent.id, true);

      log.info('TaskExecutor: Task completed', { taskId });
      return finalResult;

    } catch (error) {
      log.error('TaskExecutor: Task failed', { taskId, error: error.message });

      await this.failTask(taskId, error.message);
      await AgentCore.updateStats(this.agent.id, false);

      throw error;
    }
  }

  /**
   * Think and plan phase
   */
  async thinkAndPlan(taskId, taskDescription, inputData) {
    const startTime = Date.now();

    // Create thinking step
    const thinkStep = await this.createStep(taskId, 1, 'think', 'think', {
      task: taskDescription,
      input: inputData
    });

    // Simulate AI thinking (in real implementation, call OpenAI)
    const thinkingResult = await this.simulateThinking(taskDescription, inputData);

    await this.completeStep(thinkStep.id, {
      analysis: thinkingResult.analysis,
      approach: thinkingResult.approach
    }, thinkingResult.reasoning, Date.now() - startTime);

    // Create planning step
    const planStep = await this.createStep(taskId, 2, 'plan', 'plan', {
      analysis: thinkingResult.analysis
    });

    const planResult = await this.simulatePlanning(taskDescription, thinkingResult);

    await this.completeStep(planStep.id, {
      steps: planResult.steps,
      estimated_steps: planResult.steps.length
    }, planResult.reasoning, Date.now() - startTime);

    // Update task with total steps
    await db.query(
      `UPDATE agent_tasks SET total_steps = $1 WHERE id = $2`,
      [planResult.steps.length + 3, taskId] // +3 for think, plan, compile
    );

    return planResult;
  }

  /**
   * Execute planned steps
   */
  async executePlan(taskId, plan) {
    const results = [];

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepNumber = i + 3; // Start from 3 (after think and plan)
      const startTime = Date.now();

      const stepRecord = await this.createStep(taskId, stepNumber, step.action, 'execute', {
        description: step.description,
        expected_output: step.expected_output
      });

      try {
        // Execute the step
        const stepResult = await this.executeStep(step);

        results.push({
          step: stepNumber,
          action: step.action,
          success: true,
          output: stepResult
        });

        await this.completeStep(stepRecord.id, {
          result: stepResult,
          success: true
        }, `Completed: ${step.description}`, Date.now() - startTime);

        // Update progress
        await db.query(
          `UPDATE agent_tasks SET completed_steps = $1 WHERE id = $2`,
          [stepNumber - 2, taskId]
        );

      } catch (error) {
        results.push({
          step: stepNumber,
          action: step.action,
          success: false,
          error: error.message
        });

        await this.failStep(stepRecord.id, error.message, Date.now() - startTime);
      }

      // Add context history
      this.context.history.push({
        step: stepNumber,
        action: step.action,
        result: results[results.length - 1]
      });
    }

    return results;
  }

  /**
   * Execute a single step
   */
  async executeStep(step) {
    // Check if step uses a tool
    if (step.tool && toolRegistry.has(step.tool)) {
      return await toolRegistry.execute(step.tool, step.params || {}, this.context);
    }

    // Simulate step execution for demo
    return await this.simulateStepExecution(step);
  }

  /**
   * Compile final result
   */
  async compileResult(taskId, taskDescription, results) {
    const startTime = Date.now();

    const compileStep = await this.createStep(taskId, results.length + 3, 'compile_result', 'complete', {
      task: taskDescription,
      step_results: results.length
    });

    const finalResult = await this.simulateCompilation(taskDescription, results);

    await this.completeStep(compileStep.id, {
      final_output: finalResult.output,
      summary: finalResult.summary
    }, 'Task completed successfully', Date.now() - startTime);

    return finalResult;
  }

  /**
   * Simulate AI thinking (replace with actual AI call in production)
   */
  async simulateThinking(taskDescription, inputData) {
    // Simulate thinking delay
    await this.delay(500);

    return {
      analysis: `Task analysis for: "${taskDescription}"`,
      approach: 'Break down task into research and compilation steps',
      reasoning: `Analyzed the task requirements. Will proceed with systematic approach to gather and present information.`
    };
  }

  /**
   * Simulate AI planning (replace with actual AI call in production)
   */
  async simulatePlanning(taskDescription, thinkingResult) {
    await this.delay(300);

    // Generate steps based on task description
    const isResearchTask = taskDescription.toLowerCase().includes('tap') ||
                          taskDescription.toLowerCase().includes('araşdır') ||
                          taskDescription.toLowerCase().includes('find') ||
                          taskDescription.toLowerCase().includes('search');

    const steps = isResearchTask ? [
      { action: 'research', description: 'Gather information', expected_output: 'Raw data' },
      { action: 'analyze', description: 'Analyze gathered data', expected_output: 'Analyzed data' },
      { action: 'format', description: 'Format results', expected_output: 'Formatted output' }
    ] : [
      { action: 'process', description: 'Process the request', expected_output: 'Processed data' },
      { action: 'verify', description: 'Verify results', expected_output: 'Verified output' }
    ];

    return {
      steps,
      reasoning: `Created ${steps.length} step plan for task execution`
    };
  }

  /**
   * Simulate step execution (replace with actual AI call in production)
   */
  async simulateStepExecution(step) {
    await this.delay(800);

    // Demo results for Python libraries task
    if (step.action === 'research') {
      return {
        data: [
          { name: 'NumPy', description: 'Numerical computing with powerful N-dimensional arrays' },
          { name: 'Pandas', description: 'Data manipulation and analysis with DataFrames' },
          { name: 'Requests', description: 'Simple HTTP library for making web requests' },
          { name: 'Flask', description: 'Lightweight web framework for building web applications' },
          { name: 'TensorFlow', description: 'Machine learning and deep learning framework' }
        ]
      };
    }

    if (step.action === 'analyze') {
      return {
        analysis: 'All libraries are widely used and well-documented',
        categories: ['data-science', 'web', 'ml']
      };
    }

    if (step.action === 'format') {
      return {
        formatted: true,
        items: 5
      };
    }

    return { completed: true, action: step.action };
  }

  /**
   * Simulate final compilation
   */
  async simulateCompilation(taskDescription, results) {
    await this.delay(400);

    // Check for research data in results
    const researchResult = results.find(r => r.action === 'research');
    const libraries = researchResult?.output?.data || [];

    if (libraries.length > 0) {
      const output = libraries.map((lib, i) =>
        `${i + 1}. **${lib.name}**: ${lib.description}`
      ).join('\n\n');

      return {
        output,
        summary: `Found ${libraries.length} popular Python libraries`,
        success: true,
        items: libraries
      };
    }

    return {
      output: `Task "${taskDescription}" completed successfully`,
      summary: 'Task executed with all steps completed',
      success: true
    };
  }

  /**
   * Helper methods for database operations
   */
  async createStep(taskId, stepNumber, action, actionType, input) {
    const result = await db.query(
      `INSERT INTO task_steps
       (task_id, step_number, action, action_type, input, status)
       VALUES ($1, $2, $3, $4, $5, 'running')
       RETURNING *`,
      [taskId, stepNumber, action, actionType, JSON.stringify(input)]
    );
    return result.rows[0];
  }

  async completeStep(stepId, output, reasoning, durationMs) {
    await db.query(
      `UPDATE task_steps
       SET status = 'completed', output = $1, reasoning = $2, duration_ms = $3, completed_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [JSON.stringify(output), reasoning, durationMs, stepId]
    );
  }

  async failStep(stepId, errorMessage, durationMs) {
    await db.query(
      `UPDATE task_steps
       SET status = 'failed', error_message = $1, duration_ms = $2, completed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [errorMessage, durationMs, stepId]
    );
  }

  async updateTaskStatus(taskId, status) {
    const updates = { status };
    if (status === 'running') {
      await db.query(
        `UPDATE agent_tasks SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [status, taskId]
      );
    } else {
      await db.query(
        `UPDATE agent_tasks SET status = $1 WHERE id = $2`,
        [status, taskId]
      );
    }
  }

  async completeTask(taskId, result) {
    await db.query(
      `UPDATE agent_tasks
       SET status = 'completed', result = $1, completed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(result), taskId]
    );
  }

  async failTask(taskId, errorMessage) {
    await db.query(
      `UPDATE agent_tasks
       SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [errorMessage, taskId]
    );
  }

  /**
   * Utility methods
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static parseTask(row) {
    if (!row) return null;
    return {
      ...row,
      input_data: typeof row.input_data === 'string' ? JSON.parse(row.input_data) : row.input_data || {},
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result
    };
  }

  static parseStep(row) {
    if (!row) return null;
    return {
      ...row,
      input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
      output: typeof row.output === 'string' ? JSON.parse(row.output) : row.output
    };
  }

  // =============================================
  // MEMORY MANAGEMENT METHODS
  // =============================================

  /**
   * Add to short-term memory (recent interactions)
   */
  addToShortTermMemory(item) {
    this.context.shortTermMemory.push({
      ...item,
      timestamp: new Date().toISOString()
    });

    // Keep only recent items
    if (this.context.shortTermMemory.length > TASK_PLANNER_CONFIG.contextWindowSize) {
      this.context.shortTermMemory.shift();
    }
  }

  /**
   * Store in long-term memory (persistent key-value)
   */
  storeLongTermMemory(key, value) {
    this.context.longTermMemory.set(key, {
      value,
      storedAt: new Date().toISOString(),
      accessCount: 0
    });
  }

  /**
   * Retrieve from long-term memory
   */
  retrieveLongTermMemory(key) {
    const item = this.context.longTermMemory.get(key);
    if (item) {
      item.accessCount++;
      item.lastAccessedAt = new Date().toISOString();
      return item.value;
    }
    return null;
  }

  /**
   * Update working memory for current task
   */
  updateWorkingMemory(key, value) {
    this.context.workingMemory[key] = value;
  }

  /**
   * Clear working memory (call between tasks)
   */
  clearWorkingMemory() {
    this.context.workingMemory = {};
  }

  /**
   * Get relevant context for decision making
   */
  getRelevantContext(query = '') {
    // Combine short-term memory with relevant long-term memories
    const recentHistory = this.context.shortTermMemory.slice(-5);

    // Search long-term memory for relevant items
    const relevantLongTerm = [];
    for (const [key, item] of this.context.longTermMemory) {
      if (query && key.toLowerCase().includes(query.toLowerCase())) {
        relevantLongTerm.push({ key, ...item });
      }
    }

    return {
      recentHistory,
      relevantLongTerm: relevantLongTerm.slice(0, 5),
      workingMemory: { ...this.context.workingMemory }
    };
  }

  /**
   * Persist memory to database (if enabled)
   */
  async persistMemory() {
    if (!TASK_PLANNER_CONFIG.enableMemoryPersistence) return;

    try {
      const memoryData = {
        shortTermMemory: this.context.shortTermMemory,
        longTermMemory: Array.from(this.context.longTermMemory.entries()),
        savedAt: new Date().toISOString()
      };

      await db.query(
        `INSERT INTO agent_memory (agent_id, memory_data, created_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (agent_id) DO UPDATE SET memory_data = $2, updated_at = CURRENT_TIMESTAMP`,
        [this.agent.id, JSON.stringify(memoryData)]
      );

      log.info('TaskExecutor: Memory persisted', { agentId: this.agent.id });
    } catch (error) {
      log.error('TaskExecutor: Failed to persist memory', { error: error.message });
    }
  }

  /**
   * Load memory from database
   */
  async loadMemory() {
    if (!TASK_PLANNER_CONFIG.enableMemoryPersistence) return;

    try {
      const result = await db.query(
        `SELECT memory_data FROM agent_memory WHERE agent_id = $1`,
        [this.agent.id]
      );

      if (result.rows.length > 0) {
        const memoryData = result.rows[0].memory_data;
        const parsed = typeof memoryData === 'string' ? JSON.parse(memoryData) : memoryData;

        this.context.shortTermMemory = parsed.shortTermMemory || [];
        this.context.longTermMemory = new Map(parsed.longTermMemory || []);

        log.info('TaskExecutor: Memory loaded', { agentId: this.agent.id });
      }
    } catch (error) {
      log.error('TaskExecutor: Failed to load memory', { error: error.message });
    }
  }

  // =============================================
  // ERROR RECOVERY METHODS
  // =============================================

  /**
   * Attempt to recover from error
   */
  async attemptRecovery(error, step, retryCount) {
    const errorType = this.classifyError(error);
    const strategy = this.recoveryStrategies.get(errorType);

    if (!strategy) {
      return { action: 'abort', message: 'No recovery strategy available' };
    }

    // Track error for analysis
    this.errorHistory.push({
      type: errorType,
      message: error.message,
      step: step.action,
      timestamp: new Date().toISOString(),
      retryCount
    });

    // Apply recovery strategy
    return await strategy(error, step);
  }

  /**
   * Execute step with error recovery
   */
  async executeStepWithRecovery(step, stepNumber) {
    let retryCount = 0;
    let lastError = null;

    while (retryCount <= TASK_PLANNER_CONFIG.maxRetries) {
      try {
        const result = await this.executeStep(step);

        // Success - add to memory
        this.addToShortTermMemory({
          type: 'step_success',
          action: step.action,
          result: result
        });

        return {
          success: true,
          output: result,
          retryCount
        };

      } catch (error) {
        lastError = error;
        retryCount++;

        log.warn('TaskExecutor: Step execution failed', {
          step: step.action,
          error: error.message,
          retryCount
        });

        // Try recovery
        const recovery = await this.attemptRecovery(error, step, retryCount);

        switch (recovery.action) {
          case 'retry':
            log.info('TaskExecutor: Retrying step', { step: step.action, reason: recovery.message });
            await this.delay(TASK_PLANNER_CONFIG.retryDelayMs * retryCount);
            continue;

          case 'skip':
            log.info('TaskExecutor: Skipping step', { step: step.action, reason: recovery.message });
            return {
              success: true,
              skipped: true,
              output: { skipped: true, reason: recovery.message },
              retryCount
            };

          case 'abort':
            log.error('TaskExecutor: Aborting task', { step: step.action, reason: recovery.message });
            throw new Error(`Task aborted: ${recovery.message}`);

          default:
            // Unknown action, continue with retry
            break;
        }
      }
    }

    // All retries exhausted
    this.addToShortTermMemory({
      type: 'step_failure',
      action: step.action,
      error: lastError.message,
      retryCount
    });

    throw lastError;
  }

  // =============================================
  // TOOL EXECUTION LOGGING
  // =============================================

  /**
   * Log tool execution
   */
  logToolExecution(toolName, input, output, duration, success) {
    const logEntry = {
      tool: toolName,
      input: this.sanitizeForLog(input),
      output: this.sanitizeForLog(output),
      duration,
      success,
      timestamp: new Date().toISOString()
    };

    this.context.toolLogs.push(logEntry);

    // Keep only recent logs
    if (this.context.toolLogs.length > 100) {
      this.context.toolLogs = this.context.toolLogs.slice(-50);
    }

    return logEntry;
  }

  /**
   * Get tool execution logs
   */
  getToolLogs(limit = 50) {
    return this.context.toolLogs.slice(-limit);
  }

  /**
   * Sanitize data for logging (remove sensitive info)
   */
  sanitizeForLog(data) {
    if (!data) return data;

    const sensitiveKeys = ['password', 'token', 'api_key', 'secret', 'auth', 'credential'];
    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // =============================================
  // ADVANCED TASK PLANNING
  // =============================================

  /**
   * Create adaptive execution plan
   */
  async createAdaptivePlan(taskDescription, inputData) {
    const plan = {
      id: `plan_${Date.now()}`,
      taskDescription,
      inputData,
      steps: [],
      dependencies: new Map(),
      parallelGroups: [],
      estimatedDuration: 0,
      createdAt: new Date().toISOString()
    };

    // Analyze task to generate steps
    const analysis = await this.simulateThinking(taskDescription, inputData);
    const planResult = await this.simulatePlanning(taskDescription, analysis);

    plan.steps = planResult.steps.map((step, index) => ({
      ...step,
      id: `step_${index}`,
      status: 'pending',
      priority: step.priority || 'normal',
      canRunInParallel: step.canRunInParallel || false,
      dependencies: step.dependencies || [],
      timeout: step.timeout || 30000
    }));

    // Group steps that can run in parallel
    plan.parallelGroups = this.identifyParallelGroups(plan.steps);

    // Estimate duration
    plan.estimatedDuration = plan.steps.reduce((sum, s) => sum + (s.timeout / 2), 0);

    this.currentPlan = plan;
    return plan;
  }

  /**
   * Identify groups of steps that can run in parallel
   */
  identifyParallelGroups(steps) {
    const groups = [];
    let currentGroup = [];

    for (const step of steps) {
      if (step.canRunInParallel && step.dependencies.length === 0) {
        currentGroup.push(step.id);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
          currentGroup = [];
        }
        groups.push([step.id]); // Single step group
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Revise plan based on execution results
   */
  async revisePlan(failedStep, error) {
    if (this.planRevisions >= this.maxPlanRevisions) {
      log.warn('TaskExecutor: Max plan revisions reached');
      return null;
    }

    this.planRevisions++;

    log.info('TaskExecutor: Revising plan', {
      failedStep: failedStep.action,
      revision: this.planRevisions
    });

    // Create alternative steps
    const alternativeSteps = this.generateAlternativeSteps(failedStep, error);

    // Update current plan
    if (this.currentPlan) {
      const failedIndex = this.currentPlan.steps.findIndex(s => s.id === failedStep.id);
      if (failedIndex !== -1) {
        // Replace failed step with alternatives
        this.currentPlan.steps.splice(failedIndex, 1, ...alternativeSteps);
        this.currentPlan.revisedAt = new Date().toISOString();
        this.currentPlan.revisionCount = this.planRevisions;
      }
    }

    return alternativeSteps;
  }

  /**
   * Generate alternative steps when one fails
   */
  generateAlternativeSteps(failedStep, error) {
    // Simple heuristic-based alternatives
    const alternatives = [];

    // If it was a web scrape that failed, try different approach
    if (failedStep.tool === 'browser' || failedStep.action === 'scrape') {
      alternatives.push({
        ...failedStep,
        id: `${failedStep.id}_alt`,
        action: 'research_fallback',
        description: `Alternative approach for: ${failedStep.description}`,
        usePuppeteer: !failedStep.usePuppeteer // Try opposite approach
      });
    }

    // Add a delay step if it was a rate limit
    if (error.message?.includes('rate limit')) {
      alternatives.push({
        id: `${failedStep.id}_wait`,
        action: 'wait',
        description: 'Wait for rate limit to reset',
        waitTime: 60000
      });
      alternatives.push(failedStep); // Retry original step
    }

    // Default: just retry with modified parameters
    if (alternatives.length === 0) {
      alternatives.push({
        ...failedStep,
        id: `${failedStep.id}_retry`,
        description: `Retry: ${failedStep.description}`,
        timeout: (failedStep.timeout || 30000) * 2 // Double timeout
      });
    }

    return alternatives;
  }

  /**
   * Get task execution statistics
   */
  getExecutionStats() {
    return {
      shortTermMemorySize: this.context.shortTermMemory.length,
      longTermMemorySize: this.context.longTermMemory.size,
      toolLogCount: this.context.toolLogs.length,
      errorCount: this.errorHistory.length,
      planRevisions: this.planRevisions,
      currentPlan: this.currentPlan ? {
        id: this.currentPlan.id,
        stepCount: this.currentPlan.steps?.length,
        estimatedDuration: this.currentPlan.estimatedDuration
      } : null
    };
  }
}

module.exports = TaskExecutor;

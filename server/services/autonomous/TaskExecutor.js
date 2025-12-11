/**
 * Task Executor for Autonomous Agents
 * Handles multi-step task execution with AI reasoning
 */

const db = require('../../db');
const log = require('../../utils/logger');
const AgentCore = require('./AgentCore');
const toolRegistry = require('./ToolRegistry');

class TaskExecutor {
  constructor(agent) {
    this.agent = agent;
    this.context = {
      notes: {},
      history: []
    };
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
}

module.exports = TaskExecutor;

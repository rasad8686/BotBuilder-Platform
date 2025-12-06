/**
 * CustomAgent - User-defined custom behavior
 */

const Agent = require('../core/Agent');

class CustomAgent extends Agent {
  constructor(config) {
    super({
      ...config,
      role: config.role || 'custom'
    });

    this.customBehavior = config.customBehavior || null;
    this.inputTransformer = config.inputTransformer || null;
    this.outputTransformer = config.outputTransformer || null;
    this.validators = config.validators || [];
    this.hooks = {
      beforeExecute: config.beforeExecute || null,
      afterExecute: config.afterExecute || null,
      onError: config.onError || null
    };
  }

  /**
   * Set custom behavior function
   * @param {Function} behavior - Custom behavior function
   */
  setCustomBehavior(behavior) {
    this.customBehavior = behavior;
  }

  /**
   * Set input transformer
   * @param {Function} transformer - Input transformer function
   */
  setInputTransformer(transformer) {
    this.inputTransformer = transformer;
  }

  /**
   * Set output transformer
   * @param {Function} transformer - Output transformer function
   */
  setOutputTransformer(transformer) {
    this.outputTransformer = transformer;
  }

  /**
   * Add a validator
   * @param {Function} validator - Validator function
   */
  addValidator(validator) {
    this.validators.push(validator);
  }

  /**
   * Set lifecycle hooks
   * @param {string} hookName - Hook name
   * @param {Function} hookFn - Hook function
   */
  setHook(hookName, hookFn) {
    if (this.hooks.hasOwnProperty(hookName)) {
      this.hooks[hookName] = hookFn;
    }
  }

  /**
   * Execute with custom behavior
   */
  async execute(input, context) {
    const startTime = Date.now();

    try {
      // Run beforeExecute hook
      if (this.hooks.beforeExecute) {
        await this.hooks.beforeExecute(input, context);
      }

      // Transform input if transformer is set
      let processedInput = input;
      if (this.inputTransformer) {
        processedInput = await this.inputTransformer(input, context);
      }

      // Validate input
      for (const validator of this.validators) {
        const validationResult = await validator(processedInput, context);
        if (!validationResult.valid) {
          return {
            success: false,
            error: validationResult.error || 'Validation failed',
            durationMs: Date.now() - startTime
          };
        }
      }

      // Execute custom behavior or default LLM call
      let result;
      if (this.customBehavior) {
        result = await this.customBehavior(processedInput, context, this);
      } else {
        result = await super.execute(processedInput, context);
      }

      // Transform output if transformer is set
      if (result.success && this.outputTransformer) {
        result.output = await this.outputTransformer(result.output, context);
      }

      // Run afterExecute hook
      if (this.hooks.afterExecute) {
        await this.hooks.afterExecute(result, context);
      }

      return result;
    } catch (error) {
      // Run onError hook
      if (this.hooks.onError) {
        await this.hooks.onError(error, context);
      }

      return {
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * Create a custom agent from a simple configuration
   * @param {Object} config - Simple configuration
   * @returns {CustomAgent} - Configured custom agent
   */
  static fromSimpleConfig(config) {
    return new CustomAgent({
      id: config.id,
      name: config.name,
      role: config.role || 'custom',
      systemPrompt: config.systemPrompt || config.prompt,
      modelProvider: config.modelProvider || 'openai',
      modelName: config.modelName || 'gpt-4',
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      capabilities: config.capabilities,
      tools: config.tools
    });
  }

  /**
   * Clone this agent with new configuration
   * @param {Object} overrides - Configuration overrides
   * @returns {CustomAgent} - Cloned agent
   */
  clone(overrides = {}) {
    return new CustomAgent({
      id: overrides.id || `${this.id}_clone`,
      name: overrides.name || `${this.name} (Clone)`,
      role: overrides.role || this.role,
      systemPrompt: overrides.systemPrompt || this.systemPrompt,
      modelProvider: overrides.modelProvider || this.modelProvider,
      modelName: overrides.modelName || this.modelName,
      temperature: overrides.temperature ?? this.temperature,
      maxTokens: overrides.maxTokens || this.maxTokens,
      capabilities: overrides.capabilities || [...this.capabilities],
      tools: overrides.tools || [...this.tools],
      customBehavior: overrides.customBehavior || this.customBehavior,
      inputTransformer: overrides.inputTransformer || this.inputTransformer,
      outputTransformer: overrides.outputTransformer || this.outputTransformer,
      validators: overrides.validators || [...this.validators],
      beforeExecute: overrides.beforeExecute || this.hooks.beforeExecute,
      afterExecute: overrides.afterExecute || this.hooks.afterExecute,
      onError: overrides.onError || this.hooks.onError
    });
  }
}

module.exports = CustomAgent;

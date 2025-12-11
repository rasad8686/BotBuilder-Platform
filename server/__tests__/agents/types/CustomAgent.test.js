/**
 * CustomAgent Tests
 * Tests for server/agents/types/CustomAgent.js
 */

jest.mock('openai', () => jest.fn());
jest.mock('@anthropic-ai/sdk', () => jest.fn());
jest.mock('../../../models/AgentTool', () => ({ findEnabledByAgentId: jest.fn() }));
jest.mock('../../../models/Tool', () => ({ findById: jest.fn() }));
jest.mock('../../../tools/types', () => ({ createTool: jest.fn() }));
jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const CustomAgent = require('../../../agents/types/CustomAgent');

describe('CustomAgent', () => {
  let customAgent;

  beforeEach(() => {
    customAgent = new CustomAgent({
      id: 1,
      name: 'TestCustomAgent'
    });
  });

  describe('constructor', () => {
    it('should set default role to custom', () => {
      expect(customAgent.role).toBe('custom');
    });

    it('should use custom role if provided', () => {
      const agent = new CustomAgent({
        id: 2,
        role: 'specialist'
      });

      expect(agent.role).toBe('specialist');
    });

    it('should initialize customBehavior as null', () => {
      expect(customAgent.customBehavior).toBeNull();
    });

    it('should initialize inputTransformer as null', () => {
      expect(customAgent.inputTransformer).toBeNull();
    });

    it('should initialize outputTransformer as null', () => {
      expect(customAgent.outputTransformer).toBeNull();
    });

    it('should initialize empty validators array', () => {
      expect(customAgent.validators).toEqual([]);
    });

    it('should initialize hooks object', () => {
      expect(customAgent.hooks).toEqual({
        beforeExecute: null,
        afterExecute: null,
        onError: null
      });
    });

    it('should accept custom behavior in config', () => {
      const behavior = jest.fn();
      const agent = new CustomAgent({
        id: 1,
        customBehavior: behavior
      });

      expect(agent.customBehavior).toBe(behavior);
    });

    it('should accept hooks in config', () => {
      const beforeFn = jest.fn();
      const agent = new CustomAgent({
        id: 1,
        beforeExecute: beforeFn
      });

      expect(agent.hooks.beforeExecute).toBe(beforeFn);
    });
  });

  describe('setCustomBehavior', () => {
    it('should set custom behavior', () => {
      const behavior = jest.fn();
      customAgent.setCustomBehavior(behavior);

      expect(customAgent.customBehavior).toBe(behavior);
    });
  });

  describe('setInputTransformer', () => {
    it('should set input transformer', () => {
      const transformer = jest.fn();
      customAgent.setInputTransformer(transformer);

      expect(customAgent.inputTransformer).toBe(transformer);
    });
  });

  describe('setOutputTransformer', () => {
    it('should set output transformer', () => {
      const transformer = jest.fn();
      customAgent.setOutputTransformer(transformer);

      expect(customAgent.outputTransformer).toBe(transformer);
    });
  });

  describe('addValidator', () => {
    it('should add validator to array', () => {
      const validator = jest.fn();
      customAgent.addValidator(validator);

      expect(customAgent.validators).toContain(validator);
    });

    it('should allow multiple validators', () => {
      const v1 = jest.fn();
      const v2 = jest.fn();

      customAgent.addValidator(v1);
      customAgent.addValidator(v2);

      expect(customAgent.validators).toHaveLength(2);
    });
  });

  describe('setHook', () => {
    it('should set beforeExecute hook', () => {
      const hook = jest.fn();
      customAgent.setHook('beforeExecute', hook);

      expect(customAgent.hooks.beforeExecute).toBe(hook);
    });

    it('should set afterExecute hook', () => {
      const hook = jest.fn();
      customAgent.setHook('afterExecute', hook);

      expect(customAgent.hooks.afterExecute).toBe(hook);
    });

    it('should set onError hook', () => {
      const hook = jest.fn();
      customAgent.setHook('onError', hook);

      expect(customAgent.hooks.onError).toBe(hook);
    });

    it('should not set invalid hook names', () => {
      const hook = jest.fn();
      customAgent.setHook('invalidHook', hook);

      expect(customAgent.hooks.invalidHook).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should call beforeExecute hook', async () => {
      const beforeHook = jest.fn();
      customAgent.setHook('beforeExecute', beforeHook);
      customAgent.setCustomBehavior(async () => ({ success: true, output: 'done' }));

      await customAgent.execute('input', {});

      expect(beforeHook).toHaveBeenCalledWith('input', {});
    });

    it('should transform input if transformer is set', async () => {
      const transformer = jest.fn().mockResolvedValue('transformed');
      customAgent.setInputTransformer(transformer);
      customAgent.setCustomBehavior(async (input) => ({ success: true, output: input }));

      const result = await customAgent.execute('original', {});

      expect(transformer).toHaveBeenCalledWith('original', {});
      expect(result.output).toBe('transformed');
    });

    it('should run validators', async () => {
      const validator = jest.fn().mockResolvedValue({ valid: true });
      customAgent.addValidator(validator);
      customAgent.setCustomBehavior(async () => ({ success: true, output: 'done' }));

      await customAgent.execute('input', {});

      expect(validator).toHaveBeenCalled();
    });

    it('should fail if validator fails', async () => {
      const validator = jest.fn().mockResolvedValue({ valid: false, error: 'Invalid' });
      customAgent.addValidator(validator);
      customAgent.setCustomBehavior(async () => ({ success: true, output: 'done' }));

      const result = await customAgent.execute('input', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid');
    });

    it('should use custom behavior if set', async () => {
      const behavior = jest.fn().mockResolvedValue({ success: true, output: 'custom result' });
      customAgent.setCustomBehavior(behavior);

      const result = await customAgent.execute('input', {});

      expect(behavior).toHaveBeenCalled();
      expect(result.output).toBe('custom result');
    });

    it('should transform output if transformer is set', async () => {
      const outputTransformer = jest.fn().mockResolvedValue('transformed output');
      customAgent.setOutputTransformer(outputTransformer);
      customAgent.setCustomBehavior(async () => ({ success: true, output: 'original' }));

      const result = await customAgent.execute('input', {});

      expect(outputTransformer).toHaveBeenCalledWith('original', {});
      expect(result.output).toBe('transformed output');
    });

    it('should call afterExecute hook', async () => {
      const afterHook = jest.fn();
      customAgent.setHook('afterExecute', afterHook);
      customAgent.setCustomBehavior(async () => ({ success: true, output: 'done' }));

      await customAgent.execute('input', {});

      expect(afterHook).toHaveBeenCalled();
    });

    it('should call onError hook on error', async () => {
      const onErrorHook = jest.fn();
      customAgent.setHook('onError', onErrorHook);
      customAgent.setCustomBehavior(async () => { throw new Error('Test error'); });

      const result = await customAgent.execute('input', {});

      expect(onErrorHook).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should include duration in result on error', async () => {
      customAgent.setCustomBehavior(async () => { throw new Error('Error'); });

      const result = await customAgent.execute('input', {});

      expect(result.durationMs).toBeDefined();
    });
  });

  describe('fromSimpleConfig', () => {
    it('should create agent from simple config', () => {
      const agent = CustomAgent.fromSimpleConfig({
        id: 'simple_1',
        name: 'SimpleAgent',
        prompt: 'Do something'
      });

      expect(agent.id).toBe('simple_1');
      expect(agent.name).toBe('SimpleAgent');
      expect(agent.systemPrompt).toBe('Do something');
    });

    it('should use systemPrompt over prompt', () => {
      const agent = CustomAgent.fromSimpleConfig({
        id: 'simple_2',
        systemPrompt: 'System prompt',
        prompt: 'Regular prompt'
      });

      expect(agent.systemPrompt).toBe('System prompt');
    });

    it('should set default model provider and name', () => {
      const agent = CustomAgent.fromSimpleConfig({
        id: 'simple_3'
      });

      expect(agent.modelProvider).toBe('openai');
      expect(agent.modelName).toBe('gpt-4');
    });
  });

  describe('clone', () => {
    it('should create a clone with new id', () => {
      customAgent.name = 'Original';
      const clone = customAgent.clone();

      expect(clone.id).toBe('1_clone');
      expect(clone.name).toBe('Original (Clone)');
    });

    it('should apply overrides', () => {
      const clone = customAgent.clone({
        id: 'new_id',
        name: 'New Name'
      });

      expect(clone.id).toBe('new_id');
      expect(clone.name).toBe('New Name');
    });

    it('should preserve original properties', () => {
      customAgent.systemPrompt = 'Original prompt';
      customAgent.temperature = 0.7;

      const clone = customAgent.clone();

      expect(clone.systemPrompt).toBe('Original prompt');
      expect(clone.temperature).toBe(0.7);
    });

    it('should copy custom behavior', () => {
      const behavior = jest.fn();
      customAgent.setCustomBehavior(behavior);

      const clone = customAgent.clone();

      expect(clone.customBehavior).toBe(behavior);
    });
  });
});

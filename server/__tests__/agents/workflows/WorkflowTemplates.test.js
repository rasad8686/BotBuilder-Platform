/**
 * WorkflowTemplates Tests
 * Tests for server/agents/workflows/WorkflowTemplates.js
 */

const WorkflowTemplates = require('../../../agents/workflows/WorkflowTemplates');

describe('WorkflowTemplates', () => {
  let templates;

  beforeEach(() => {
    templates = new WorkflowTemplates();
  });

  describe('constructor', () => {
    it('should initialize with preset templates', () => {
      expect(templates.templates).toBeDefined();
      expect(templates.templates.CustomerSupport).toBeDefined();
      expect(templates.templates.ContentCreation).toBeDefined();
      expect(templates.templates.DataAnalysis).toBeDefined();
      expect(templates.templates.SimpleChat).toBeDefined();
    });
  });

  describe('getTemplate', () => {
    it('should return template by ID', () => {
      const template = templates.getTemplate('CustomerSupport');

      expect(template).toBeDefined();
      expect(template.name).toBe('Customer Support');
    });

    it('should return null for unknown template', () => {
      expect(templates.getTemplate('Unknown')).toBeNull();
    });
  });

  describe('getAllTemplates', () => {
    it('should return all templates with metadata', () => {
      const all = templates.getAllTemplates();

      expect(all.length).toBeGreaterThan(0);
      expect(all[0]).toHaveProperty('id');
      expect(all[0]).toHaveProperty('name');
      expect(all[0]).toHaveProperty('description');
      expect(all[0]).toHaveProperty('workflowType');
      expect(all[0]).toHaveProperty('agentCount');
      expect(all[0]).toHaveProperty('agents');
    });

    it('should include agent info', () => {
      const all = templates.getAllTemplates();
      const customerSupport = all.find(t => t.key === 'CustomerSupport');

      expect(customerSupport.agents).toHaveLength(3);
      expect(customerSupport.agents[0]).toHaveProperty('role');
      expect(customerSupport.agents[0]).toHaveProperty('name');
    });
  });

  describe('createFromTemplate', () => {
    it('should create workflow config from template', () => {
      const config = templates.createFromTemplate('CustomerSupport', 123);

      expect(config.bot_id).toBe(123);
      expect(config.name).toBe('Customer Support');
      expect(config.workflow_type).toBe('sequential');
      expect(config.agents_config).toHaveLength(3);
      expect(config.is_active).toBe(true);
    });

    it('should throw for unknown template', () => {
      expect(() => {
        templates.createFromTemplate('Unknown', 1);
      }).toThrow('Template not found: Unknown');
    });

    it('should apply custom options', () => {
      const config = templates.createFromTemplate('SimpleChat', 1, {
        name: 'My Custom Chat',
        isDefault: true,
        modelProvider: 'anthropic',
        modelName: 'claude-3-sonnet'
      });

      expect(config.name).toBe('My Custom Chat');
      expect(config.is_default).toBe(true);
      expect(config.agents_config[0].config.model_provider).toBe('anthropic');
      expect(config.agents_config[0].config.model_name).toBe('claude-3-sonnet');
    });

    it('should include agent order', () => {
      const config = templates.createFromTemplate('ContentCreation', 1);

      expect(config.agents_config[0].order).toBe(0);
      expect(config.agents_config[1].order).toBe(1);
      expect(config.agents_config[2].order).toBe(2);
    });

    it('should allow custom agent names', () => {
      const config = templates.createFromTemplate('SimpleChat', 1, {
        agentNames: ['My Custom Assistant']
      });

      expect(config.agents_config[0].config.name).toBe('My Custom Assistant');
    });

    it('should allow custom system prompts', () => {
      const config = templates.createFromTemplate('SimpleChat', 1, {
        systemPrompts: ['You are a specialized bot.']
      });

      expect(config.agents_config[0].config.system_prompt).toBe('You are a specialized bot.');
    });

    it('should include template agents for creation', () => {
      const config = templates.createFromTemplate('DataAnalysis', 1);

      expect(config._templateAgents).toBeDefined();
      expect(config._templateAgents).toHaveLength(2);
    });
  });

  describe('getTemplateAgents', () => {
    it('should return agent definitions', () => {
      const agents = templates.getTemplateAgents('CustomerSupport');

      expect(agents).toHaveLength(3);
      expect(agents[0].name).toBe('Intent Router');
      expect(agents[0].role).toBe('router');
      expect(agents[0].system_prompt).toBeDefined();
      expect(agents[0].model_provider).toBe('openai');
      expect(agents[0].model_name).toBe('gpt-4');
      expect(agents[0].temperature).toBe(0.3);
    });

    it('should return empty array for unknown template', () => {
      expect(templates.getTemplateAgents('Unknown')).toEqual([]);
    });

    it('should include defaults for optional fields', () => {
      const agents = templates.getTemplateAgents('SimpleChat');

      expect(agents[0].max_tokens).toBe(2048);
      expect(agents[0].capabilities).toEqual([]);
      expect(agents[0].tools).toEqual([]);
    });
  });

  describe('Template: CustomerSupport', () => {
    it('should have correct structure', () => {
      const template = templates.getTemplate('CustomerSupport');

      expect(template.id).toBe('customer-support');
      expect(template.workflow_type).toBe('sequential');
      expect(template.agents).toHaveLength(3);

      // Check agent roles in order
      expect(template.agents[0].role).toBe('router');
      expect(template.agents[1].role).toBe('researcher');
      expect(template.agents[2].role).toBe('writer');
    });
  });

  describe('Template: ContentCreation', () => {
    it('should have correct structure', () => {
      const template = templates.getTemplate('ContentCreation');

      expect(template.id).toBe('content-creation');
      expect(template.agents).toHaveLength(3);

      expect(template.agents[0].role).toBe('researcher');
      expect(template.agents[1].role).toBe('writer');
      expect(template.agents[2].role).toBe('reviewer');
    });
  });

  describe('Template: DataAnalysis', () => {
    it('should have correct structure', () => {
      const template = templates.getTemplate('DataAnalysis');

      expect(template.id).toBe('data-analysis');
      expect(template.agents).toHaveLength(2);

      expect(template.agents[0].role).toBe('analyzer');
      expect(template.agents[1].role).toBe('writer');
    });
  });

  describe('Template: SimpleChat', () => {
    it('should have single agent', () => {
      const template = templates.getTemplate('SimpleChat');

      expect(template.id).toBe('simple-chat');
      expect(template.agents).toHaveLength(1);
      expect(template.agents[0].role).toBe('assistant');
    });
  });
});

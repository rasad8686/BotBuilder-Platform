/**
 * AgentTemplates Test Suite
 */

const AgentTemplates = require('../../services/autonomous/AgentTemplates');

describe('AgentTemplates', () => {
  describe('getAll', () => {
    it('should return all templates', () => {
      const templates = AgentTemplates.getAll();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should return templates with required fields', () => {
      const templates = AgentTemplates.getAll();

      templates.forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.category).toBeDefined();
        expect(template.role).toBeDefined();
      });
    });
  });

  describe('getById', () => {
    it('should return template by ID', () => {
      const template = AgentTemplates.getById('research-assistant');

      expect(template).toBeTruthy();
      expect(template.id).toBe('research-assistant');
      expect(template.name).toBe('Research Assistant');
    });

    it('should return null for non-existent template', () => {
      const template = AgentTemplates.getById('non-existent');

      expect(template).toBeNull();
    });
  });

  describe('getByCategory', () => {
    it('should return templates for a category', () => {
      const templates = AgentTemplates.getByCategory('research');

      expect(Array.isArray(templates)).toBe(true);
      templates.forEach(template => {
        expect(template.category).toBe('research');
      });
    });

    it('should return empty array for non-existent category', () => {
      const templates = AgentTemplates.getByCategory('non-existent');

      expect(templates).toEqual([]);
    });
  });

  describe('search', () => {
    it('should find templates by name', () => {
      const templates = AgentTemplates.search('research');

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.name.toLowerCase().includes('research'))).toBe(true);
    });

    it('should find templates by description', () => {
      const templates = AgentTemplates.search('content');

      expect(templates.length).toBeGreaterThan(0);
    });

    it('should be case insensitive', () => {
      const lowerTemplates = AgentTemplates.search('research');
      const upperTemplates = AgentTemplates.search('RESEARCH');

      expect(lowerTemplates.length).toBe(upperTemplates.length);
    });

    it('should return empty array for no matches', () => {
      const templates = AgentTemplates.search('xyznonexistent123');

      expect(templates).toEqual([]);
    });
  });

  describe('getCategories', () => {
    it('should return all categories', () => {
      const categories = AgentTemplates.getCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('research');
      expect(categories).toContain('content');
    });
  });

  describe('createAgentConfig', () => {
    it('should create agent config from template', () => {
      const config = AgentTemplates.createAgentConfig('research-assistant');

      expect(config.name).toBe('Research Assistant');
      expect(config.role).toBe('researcher');
      expect(config.model).toBeDefined();
      expect(config.system_prompt).toBeDefined();
      expect(Array.isArray(config.capabilities)).toBe(true);
    });

    it('should apply customizations', () => {
      const config = AgentTemplates.createAgentConfig('research-assistant', {
        name: 'Custom Research Bot',
        temperature: 0.5
      });

      expect(config.name).toBe('Custom Research Bot');
      expect(config.temperature).toBe(0.5);
    });

    it('should merge additional capabilities', () => {
      const config = AgentTemplates.createAgentConfig('research-assistant', {
        additionalCapabilities: ['custom_capability']
      });

      expect(config.capabilities).toContain('custom_capability');
    });

    it('should merge settings', () => {
      const config = AgentTemplates.createAgentConfig('research-assistant', {
        settings: { custom_setting: true }
      });

      expect(config.settings.custom_setting).toBe(true);
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        AgentTemplates.createAgentConfig('non-existent');
      }).toThrow('Template not found');
    });
  });

  describe('getWorkflowTemplates', () => {
    it('should return all workflow templates', () => {
      const workflows = AgentTemplates.getWorkflowTemplates();

      expect(Array.isArray(workflows)).toBe(true);
    });

    it('should return workflows with required fields', () => {
      const workflows = AgentTemplates.getWorkflowTemplates();

      workflows.forEach(workflow => {
        expect(workflow.id).toBeDefined();
        expect(workflow.name).toBeDefined();
        expect(workflow.steps).toBeDefined();
        expect(Array.isArray(workflow.steps)).toBe(true);
      });
    });
  });

  describe('getWorkflowTemplate', () => {
    it('should return workflow template by ID', () => {
      const workflow = AgentTemplates.getWorkflowTemplate('research-and-report');

      expect(workflow).toBeTruthy();
      expect(workflow.id).toBe('research-and-report');
    });

    it('should return null for non-existent workflow', () => {
      const workflow = AgentTemplates.getWorkflowTemplate('non-existent');

      expect(workflow).toBeNull();
    });
  });

  describe('createWorkflowConfig', () => {
    it('should create workflow config from template', () => {
      const config = AgentTemplates.createWorkflowConfig('research-and-report');

      expect(config.name).toBe('Research & Report');
      expect(config.steps).toBeDefined();
      expect(config.agents).toBeDefined();
    });

    it('should apply customizations', () => {
      const config = AgentTemplates.createWorkflowConfig('research-and-report', {
        name: 'Custom Workflow'
      });

      expect(config.name).toBe('Custom Workflow');
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        AgentTemplates.createWorkflowConfig('non-existent');
      }).toThrow('Workflow template not found');
    });
  });

  describe('validateCompatibility', () => {
    it('should return compatible for valid template', () => {
      const result = AgentTemplates.validateCompatibility('research-assistant', []);

      expect(result.compatible).toBe(true);
    });

    it('should return incompatible for non-existent template', () => {
      const result = AgentTemplates.validateCompatibility('non-existent', []);

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('getRecommendations', () => {
    it('should return recommendations for research use case', () => {
      const recommendations = AgentTemplates.getRecommendations('research');

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should return recommendations for content use case', () => {
      const recommendations = AgentTemplates.getRecommendations('content');

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should return empty array for unknown use case', () => {
      const recommendations = AgentTemplates.getRecommendations('unknown');

      expect(recommendations).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return template statistics', () => {
      const stats = AgentTemplates.getStats();

      expect(stats.totalTemplates).toBeGreaterThan(0);
      expect(stats.totalWorkflows).toBeGreaterThanOrEqual(0);
      expect(stats.byCategory).toBeDefined();
      expect(stats.categories).toBeDefined();
    });
  });

  describe('template content validation', () => {
    it('all templates should have valid system prompts', () => {
      const templates = AgentTemplates.getAll();

      templates.forEach(template => {
        expect(template.system_prompt).toBeDefined();
        expect(template.system_prompt.length).toBeGreaterThan(50);
      });
    });

    it('all templates should have valid roles', () => {
      const validRoles = ['orchestrator', 'researcher', 'writer', 'analyzer', 'reviewer', 'router', 'assistant'];
      const templates = AgentTemplates.getAll();

      templates.forEach(template => {
        expect(validRoles).toContain(template.role);
      });
    });

    it('all templates should have valid models', () => {
      const validModels = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'];
      const templates = AgentTemplates.getAll();

      templates.forEach(template => {
        expect(validModels).toContain(template.model);
      });
    });

    it('all templates should have capabilities array', () => {
      const templates = AgentTemplates.getAll();

      templates.forEach(template => {
        expect(Array.isArray(template.capabilities)).toBe(true);
      });
    });
  });

  describe('static properties', () => {
    it('should have TEMPLATES constant', () => {
      expect(AgentTemplates.TEMPLATES).toBeDefined();
      expect(Object.keys(AgentTemplates.TEMPLATES).length).toBeGreaterThan(0);
    });

    it('should have WORKFLOWS constant', () => {
      expect(AgentTemplates.WORKFLOWS).toBeDefined();
    });

    it('should have CATEGORIES constant', () => {
      expect(AgentTemplates.CATEGORIES).toBeDefined();
      expect(AgentTemplates.CATEGORIES.RESEARCH).toBe('research');
    });
  });
});

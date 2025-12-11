/**
 * FlowTemplates Tests
 * Tests for server/ai/FlowTemplates.js
 */

const FlowTemplates = require('../../ai/FlowTemplates');

describe('FlowTemplates', () => {
  describe('getTemplates', () => {
    it('should return all templates without flow data', () => {
      const templates = FlowTemplates.getTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('description');
      expect(templates[0]).toHaveProperty('category');
      expect(templates[0]).toHaveProperty('features');
      expect(templates[0]).not.toHaveProperty('flow');
    });

    it('should include all expected fields', () => {
      const templates = FlowTemplates.getTemplates();

      templates.forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.category).toBeDefined();
        expect(template.icon).toBeDefined();
        expect(template.difficulty).toBeDefined();
        expect(template.estimatedNodes).toBeDefined();
        expect(Array.isArray(template.features)).toBe(true);
      });
    });
  });

  describe('getTemplateById', () => {
    it('should return full template with flow data', () => {
      const template = FlowTemplates.getTemplateById('customer_support');

      expect(template).toBeDefined();
      expect(template.id).toBe('customer_support');
      expect(template.flow).toBeDefined();
      expect(template.flow.nodes).toBeDefined();
      expect(template.flow.edges).toBeDefined();
      expect(template.flow.variables).toBeDefined();
    });

    it('should return null for non-existent template', () => {
      const template = FlowTemplates.getTemplateById('non_existent');

      expect(template).toBeNull();
    });

    it('should include flow structure for customer_support', () => {
      const template = FlowTemplates.getTemplateById('customer_support');

      expect(template.flow.nodes.length).toBeGreaterThan(0);
      expect(template.flow.edges.length).toBeGreaterThan(0);

      const startNode = template.flow.nodes.find(n => n.type === 'start');
      expect(startNode).toBeDefined();
      expect(startNode.isStart).toBe(true);
    });

    it('should include flow structure for lead_generation', () => {
      const template = FlowTemplates.getTemplateById('lead_generation');

      expect(template).toBeDefined();
      expect(template.category).toBe('sales');
      expect(template.flow.nodes.length).toBeGreaterThan(10);
    });

    it('should include flow structure for faq_bot', () => {
      const template = FlowTemplates.getTemplateById('faq_bot');

      expect(template).toBeDefined();
      expect(template.category).toBe('support');
      expect(template.features).toContain('AI-powered answers');
    });

    it('should include flow structure for appointment_booking', () => {
      const template = FlowTemplates.getTemplateById('appointment_booking');

      expect(template).toBeDefined();
      expect(template.category).toBe('scheduling');
    });

    it('should include flow structure for ecommerce_support', () => {
      const template = FlowTemplates.getTemplateById('ecommerce_support');

      expect(template).toBeDefined();
      expect(template.difficulty).toBe('advanced');
    });

    it('should include flow structure for feedback_collection', () => {
      const template = FlowTemplates.getTemplateById('feedback_collection');

      expect(template).toBeDefined();
      expect(template.category).toBe('feedback');
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates in support category', () => {
      const templates = FlowTemplates.getTemplatesByCategory('support');

      expect(templates.length).toBeGreaterThan(0);
      templates.forEach(t => {
        expect(t.category).toBe('support');
      });
    });

    it('should return templates in sales category', () => {
      const templates = FlowTemplates.getTemplatesByCategory('sales');

      expect(templates.length).toBeGreaterThan(0);
      templates.forEach(t => {
        expect(t.category).toBe('sales');
      });
    });

    it('should return empty array for non-existent category', () => {
      const templates = FlowTemplates.getTemplatesByCategory('non_existent');

      expect(templates).toEqual([]);
    });

    it('should not include flow data', () => {
      const templates = FlowTemplates.getTemplatesByCategory('support');

      templates.forEach(t => {
        expect(t.flow).toBeUndefined();
      });
    });
  });

  describe('getCategories', () => {
    it('should return all unique categories', () => {
      const categories = FlowTemplates.getCategories();

      expect(categories.length).toBeGreaterThan(0);
      expect(categories.find(c => c.id === 'support')).toBeDefined();
      expect(categories.find(c => c.id === 'sales')).toBeDefined();
    });

    it('should include category metadata', () => {
      const categories = FlowTemplates.getCategories();

      categories.forEach(cat => {
        expect(cat.id).toBeDefined();
        expect(cat.name).toBeDefined();
        expect(typeof cat.count).toBe('number');
        expect(cat.count).toBeGreaterThan(0);
      });
    });

    it('should capitalize category names', () => {
      const categories = FlowTemplates.getCategories();

      categories.forEach(cat => {
        expect(cat.name.charAt(0)).toBe(cat.name.charAt(0).toUpperCase());
      });
    });

    it('should count templates correctly', () => {
      const categories = FlowTemplates.getCategories();
      const supportCategory = categories.find(c => c.id === 'support');
      const supportTemplates = FlowTemplates.getTemplatesByCategory('support');

      expect(supportCategory.count).toBe(supportTemplates.length);
    });
  });

  describe('searchTemplates', () => {
    it('should find templates by name', () => {
      const results = FlowTemplates.searchTemplates('support');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name.toLowerCase().includes('support'))).toBe(true);
    });

    it('should find templates by description', () => {
      const results = FlowTemplates.searchTemplates('customer');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should find templates by features', () => {
      const results = FlowTemplates.searchTemplates('FAQ');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.features.some(f => f.toLowerCase().includes('faq')))).toBe(true);
    });

    it('should be case insensitive', () => {
      const upperResults = FlowTemplates.searchTemplates('SUPPORT');
      const lowerResults = FlowTemplates.searchTemplates('support');

      expect(upperResults.length).toBe(lowerResults.length);
    });

    it('should return empty array for no matches', () => {
      const results = FlowTemplates.searchTemplates('xyznonexistent123');

      expect(results).toEqual([]);
    });

    it('should not include flow data in results', () => {
      const results = FlowTemplates.searchTemplates('support');

      results.forEach(t => {
        expect(t.flow).toBeUndefined();
      });
    });

    it('should search for booking templates', () => {
      const results = FlowTemplates.searchTemplates('booking');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should search for lead templates', () => {
      const results = FlowTemplates.searchTemplates('lead');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('template validation', () => {
    it('each template should have valid node types', () => {
      const validNodeTypes = [
        'start', 'message', 'question', 'condition', 'action',
        'api_call', 'set_variable', 'delay', 'end', 'goto',
        'email', 'webhook', 'ai_response', 'menu', 'input'
      ];

      const templates = FlowTemplates.getTemplates();

      templates.forEach(t => {
        const fullTemplate = FlowTemplates.getTemplateById(t.id);
        fullTemplate.flow.nodes.forEach(node => {
          expect(validNodeTypes).toContain(node.type);
        });
      });
    });

    it('each template should have a start node', () => {
      const templates = FlowTemplates.getTemplates();

      templates.forEach(t => {
        const fullTemplate = FlowTemplates.getTemplateById(t.id);
        const startNode = fullTemplate.flow.nodes.find(n => n.type === 'start');
        expect(startNode).toBeDefined();
      });
    });

    it('each template should have unique node ids', () => {
      const templates = FlowTemplates.getTemplates();

      templates.forEach(t => {
        const fullTemplate = FlowTemplates.getTemplateById(t.id);
        const nodeIds = fullTemplate.flow.nodes.map(n => n.id);
        const uniqueIds = [...new Set(nodeIds)];
        expect(nodeIds.length).toBe(uniqueIds.length);
      });
    });

    it('each edge should reference valid nodes', () => {
      const templates = FlowTemplates.getTemplates();

      templates.forEach(t => {
        const fullTemplate = FlowTemplates.getTemplateById(t.id);
        const nodeIds = new Set(fullTemplate.flow.nodes.map(n => n.id));

        fullTemplate.flow.edges.forEach(edge => {
          expect(nodeIds.has(edge.source)).toBe(true);
          expect(nodeIds.has(edge.target)).toBe(true);
        });
      });
    });
  });
});

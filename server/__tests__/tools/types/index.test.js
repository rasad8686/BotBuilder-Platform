/**
 * Tool Types Index Tests
 * Tests for server/tools/types/index.js
 */

const {
  HttpTool,
  DatabaseTool,
  CodeTool,
  WebScraperTool,
  EmailTool,
  toolTypeMap,
  createTool,
  getToolClass,
  getAvailableTypes,
  getToolSchemas,
  isValidType
} = require('../../../tools/types/index');

describe('Tool Types Index', () => {
  describe('exports', () => {
    it('should export HttpTool class', () => {
      expect(HttpTool).toBeDefined();
      expect(typeof HttpTool).toBe('function');
    });

    it('should export DatabaseTool class', () => {
      expect(DatabaseTool).toBeDefined();
      expect(typeof DatabaseTool).toBe('function');
    });

    it('should export CodeTool class', () => {
      expect(CodeTool).toBeDefined();
      expect(typeof CodeTool).toBe('function');
    });

    it('should export WebScraperTool class', () => {
      expect(WebScraperTool).toBeDefined();
      expect(typeof WebScraperTool).toBe('function');
    });

    it('should export EmailTool class', () => {
      expect(EmailTool).toBeDefined();
      expect(typeof EmailTool).toBe('function');
    });

    it('should export toolTypeMap', () => {
      expect(toolTypeMap).toBeDefined();
      expect(typeof toolTypeMap).toBe('object');
    });
  });

  describe('toolTypeMap', () => {
    it('should map http_request to HttpTool', () => {
      expect(toolTypeMap['http_request']).toBe(HttpTool);
    });

    it('should map http to HttpTool', () => {
      expect(toolTypeMap['http']).toBe(HttpTool);
    });

    it('should map api to HttpTool', () => {
      expect(toolTypeMap['api']).toBe(HttpTool);
    });

    it('should map database_query to DatabaseTool', () => {
      expect(toolTypeMap['database_query']).toBe(DatabaseTool);
    });

    it('should map database to DatabaseTool', () => {
      expect(toolTypeMap['database']).toBe(DatabaseTool);
    });

    it('should map sql to DatabaseTool', () => {
      expect(toolTypeMap['sql']).toBe(DatabaseTool);
    });

    it('should map code_execution to CodeTool', () => {
      expect(toolTypeMap['code_execution']).toBe(CodeTool);
    });

    it('should map code to CodeTool', () => {
      expect(toolTypeMap['code']).toBe(CodeTool);
    });

    it('should map javascript to CodeTool', () => {
      expect(toolTypeMap['javascript']).toBe(CodeTool);
    });

    it('should map web_scraper to WebScraperTool', () => {
      expect(toolTypeMap['web_scraper']).toBe(WebScraperTool);
    });

    it('should map scraper to WebScraperTool', () => {
      expect(toolTypeMap['scraper']).toBe(WebScraperTool);
    });

    it('should map email to EmailTool', () => {
      expect(toolTypeMap['email']).toBe(EmailTool);
    });

    it('should map smtp to EmailTool', () => {
      expect(toolTypeMap['smtp']).toBe(EmailTool);
    });

    it('should map mail to EmailTool', () => {
      expect(toolTypeMap['mail']).toBe(EmailTool);
    });
  });

  describe('createTool', () => {
    it('should create HttpTool instance', () => {
      const tool = createTool('http_request', { name: 'test' });
      expect(tool).toBeInstanceOf(HttpTool);
    });

    it('should create DatabaseTool instance', () => {
      const tool = createTool('database_query', { name: 'test' });
      expect(tool).toBeInstanceOf(DatabaseTool);
    });

    it('should create CodeTool instance', () => {
      const tool = createTool('code_execution', { name: 'test' });
      expect(tool).toBeInstanceOf(CodeTool);
    });

    it('should create WebScraperTool instance', () => {
      const tool = createTool('web_scraper', { name: 'test' });
      expect(tool).toBeInstanceOf(WebScraperTool);
    });

    it('should create EmailTool instance', () => {
      const tool = createTool('email', { name: 'test' });
      expect(tool).toBeInstanceOf(EmailTool);
    });

    it('should be case insensitive', () => {
      const tool = createTool('HTTP_REQUEST', { name: 'test' });
      expect(tool).toBeInstanceOf(HttpTool);
    });

    it('should throw error for unknown type', () => {
      expect(() => createTool('unknown_type')).toThrow('Unknown tool type: unknown_type');
    });

    it('should include available types in error message', () => {
      expect(() => createTool('invalid')).toThrow('Available types:');
    });

    it('should work with default empty config', () => {
      const tool = createTool('http');
      expect(tool).toBeInstanceOf(HttpTool);
    });
  });

  describe('getToolClass', () => {
    it('should return HttpTool class', () => {
      expect(getToolClass('http_request')).toBe(HttpTool);
    });

    it('should return DatabaseTool class', () => {
      expect(getToolClass('database_query')).toBe(DatabaseTool);
    });

    it('should return CodeTool class', () => {
      expect(getToolClass('code_execution')).toBe(CodeTool);
    });

    it('should return WebScraperTool class', () => {
      expect(getToolClass('web_scraper')).toBe(WebScraperTool);
    });

    it('should return EmailTool class', () => {
      expect(getToolClass('email')).toBe(EmailTool);
    });

    it('should be case insensitive', () => {
      expect(getToolClass('HTTP')).toBe(HttpTool);
    });

    it('should return null for unknown type', () => {
      expect(getToolClass('unknown')).toBeNull();
    });
  });

  describe('getAvailableTypes', () => {
    it('should return array of tool types', () => {
      const types = getAvailableTypes();
      expect(Array.isArray(types)).toBe(true);
    });

    it('should return 5 unique tool types', () => {
      const types = getAvailableTypes();
      expect(types).toHaveLength(5);
    });

    it('should include http_request type', () => {
      const types = getAvailableTypes();
      const httpType = types.find(t => t.type === 'http_request');
      expect(httpType).toBeDefined();
      expect(httpType.name).toBe('HttpTool');
    });

    it('should include database_query type', () => {
      const types = getAvailableTypes();
      const dbType = types.find(t => t.type === 'database_query');
      expect(dbType).toBeDefined();
    });

    it('should include code_execution type', () => {
      const types = getAvailableTypes();
      const codeType = types.find(t => t.type === 'code_execution');
      expect(codeType).toBeDefined();
    });

    it('should include web_scraper type', () => {
      const types = getAvailableTypes();
      const scraperType = types.find(t => t.type === 'web_scraper');
      expect(scraperType).toBeDefined();
    });

    it('should include email type', () => {
      const types = getAvailableTypes();
      const emailType = types.find(t => t.type === 'email');
      expect(emailType).toBeDefined();
    });

    it('should include schemas for each type', () => {
      const types = getAvailableTypes();
      types.forEach(type => {
        expect(type).toHaveProperty('inputSchema');
        expect(type).toHaveProperty('outputSchema');
        expect(type).toHaveProperty('configSchema');
      });
    });
  });

  describe('getToolSchemas', () => {
    it('should return schemas for http_request', () => {
      const schemas = getToolSchemas('http_request');
      expect(schemas).toHaveProperty('input');
      expect(schemas).toHaveProperty('output');
      expect(schemas).toHaveProperty('config');
    });

    it('should return schemas for database_query', () => {
      const schemas = getToolSchemas('database_query');
      expect(schemas).toBeDefined();
    });

    it('should return schemas for code_execution', () => {
      const schemas = getToolSchemas('code_execution');
      expect(schemas).toBeDefined();
    });

    it('should return schemas for web_scraper', () => {
      const schemas = getToolSchemas('web_scraper');
      expect(schemas).toBeDefined();
    });

    it('should return schemas for email', () => {
      const schemas = getToolSchemas('email');
      expect(schemas).toBeDefined();
    });

    it('should be case insensitive', () => {
      const schemas = getToolSchemas('HTTP');
      expect(schemas).toBeDefined();
    });

    it('should return null for unknown type', () => {
      const schemas = getToolSchemas('unknown');
      expect(schemas).toBeNull();
    });
  });

  describe('isValidType', () => {
    it('should return true for http_request', () => {
      expect(isValidType('http_request')).toBe(true);
    });

    it('should return true for http', () => {
      expect(isValidType('http')).toBe(true);
    });

    it('should return true for database_query', () => {
      expect(isValidType('database_query')).toBe(true);
    });

    it('should return true for code_execution', () => {
      expect(isValidType('code_execution')).toBe(true);
    });

    it('should return true for web_scraper', () => {
      expect(isValidType('web_scraper')).toBe(true);
    });

    it('should return true for email', () => {
      expect(isValidType('email')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isValidType('HTTP_REQUEST')).toBe(true);
    });

    it('should return false for unknown type', () => {
      expect(isValidType('unknown')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidType(null)).toBeFalsy();
    });

    it('should return false for undefined', () => {
      expect(isValidType(undefined)).toBeFalsy();
    });

    it('should return false for empty string', () => {
      expect(isValidType('')).toBeFalsy();
    });
  });
});

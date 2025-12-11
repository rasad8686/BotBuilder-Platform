/**
 * NLUImportExport Service Tests
 * Tests for server/services/NLUImportExport.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const nluImportExport = require('../../services/NLUImportExport');

describe('NLUImportExport Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('importIntentsFromCSV()', () => {
    it('should import intents from CSV data', async () => {
      const csvData = `intent_name,display_name,example_text,language
greeting,Greeting,Hello there,az
greeting,Greeting,Hi,az
goodbye,Goodbye,See you,az`;

      // Mock for first intent (greeting)
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing intent
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Create intent
        .mockResolvedValueOnce({ rows: [] }) // Check existing example
        .mockResolvedValueOnce({ rows: [] }) // Insert example
        .mockResolvedValueOnce({ rows: [] }) // Check existing example for 2nd example
        .mockResolvedValueOnce({ rows: [] }) // Insert 2nd example
        .mockResolvedValueOnce({ rows: [] }) // Check existing goodbye intent
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Create goodbye intent
        .mockResolvedValueOnce({ rows: [] }) // Check existing example
        .mockResolvedValueOnce({ rows: [] }); // Insert example

      const result = await nluImportExport.importIntentsFromCSV(1, csvData, 1);

      expect(result.imported).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should update existing intents', async () => {
      const csvData = `intent_name,display_name,example_text,language
greeting,Greeting,Hello there,az`;

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Intent exists
        .mockResolvedValueOnce({ rows: [] }) // Check existing example
        .mockResolvedValueOnce({ rows: [] }); // Insert example

      const result = await nluImportExport.importIntentsFromCSV(1, csvData, 1);

      expect(result.updated).toBe(1);
      expect(result.imported).toBe(0);
    });

    it('should throw error for missing required fields', async () => {
      const csvData = `intent_name,example_text
greeting,Hello`;

      await expect(
        nluImportExport.importIntentsFromCSV(1, csvData, 1)
      ).rejects.toThrow('Missing required field: display_name');
    });

    it('should handle errors in individual lines', async () => {
      const csvData = `intent_name,display_name,example_text,language
,Greeting,,az
greeting,Greeting,Hello,az`;

      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check greeting intent
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Create intent
        .mockResolvedValueOnce({ rows: [] }) // Check example
        .mockResolvedValueOnce({ rows: [] }); // Insert example

      const result = await nluImportExport.importIntentsFromCSV(1, csvData, 1);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
    });

    it('should skip duplicate examples', async () => {
      const csvData = `intent_name,display_name,example_text,language
greeting,Greeting,Hello,az`;

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Example already exists

      const result = await nluImportExport.importIntentsFromCSV(1, csvData, 1);

      expect(result.imported).toBe(1);
      expect(db.query).toHaveBeenCalledTimes(3); // No insert for duplicate
    });
  });

  describe('importIntentsFromJSON()', () => {
    it('should import intents from JSON data', async () => {
      const jsonData = [
        {
          name: 'greeting',
          display_name: 'Greeting',
          examples: [{ text: 'Hello', language: 'az' }, { text: 'Hi', language: 'az' }]
        }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check intent
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Create intent
        .mockResolvedValueOnce({ rows: [] }) // Check example 1
        .mockResolvedValueOnce({ rows: [] }) // Insert example 1
        .mockResolvedValueOnce({ rows: [] }) // Check example 2
        .mockResolvedValueOnce({ rows: [] }); // Insert example 2

      const result = await nluImportExport.importIntentsFromJSON(1, jsonData, 1);

      expect(result.imported).toBe(1);
    });

    it('should handle string examples', async () => {
      const jsonData = [
        {
          name: 'greeting',
          examples: ['Hello', 'Hi']
        }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await nluImportExport.importIntentsFromJSON(1, jsonData, 1);

      expect(result.imported).toBe(1);
    });

    it('should update existing intent display name', async () => {
      const jsonData = [{
        name: 'greeting',
        display_name: 'New Display Name'
      }];

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Intent exists
        .mockResolvedValueOnce({ rows: [] }); // Update display name

      const result = await nluImportExport.importIntentsFromJSON(1, jsonData, 1);

      expect(result.updated).toBe(1);
    });

    it('should handle missing intent name', async () => {
      const jsonData = [{ display_name: 'Test' }];

      const result = await nluImportExport.importIntentsFromJSON(1, jsonData, 1);

      expect(result.errors).toHaveLength(1);
    });

    it('should parse JSON string', async () => {
      const jsonData = '[{"name":"test","examples":["Hello"]}]';

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await nluImportExport.importIntentsFromJSON(1, jsonData, 1);

      expect(result.imported).toBe(1);
    });
  });

  describe('exportIntentsToCSV()', () => {
    it('should export intents to CSV format', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { intent_name: 'greeting', display_name: 'Greeting', example_text: 'Hello', language: 'az' },
          { intent_name: 'greeting', display_name: 'Greeting', example_text: 'Hi', language: 'az' },
          { intent_name: 'goodbye', display_name: 'Goodbye', example_text: 'Bye', language: 'en' }
        ]
      });

      const csv = await nluImportExport.exportIntentsToCSV(1, 1);

      expect(csv).toContain('intent_name,display_name,example_text,language');
      expect(csv).toContain('greeting,Greeting,Hello,az');
      expect(csv).toContain('goodbye,Goodbye,Bye,en');
    });

    it('should handle intents without examples', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { intent_name: 'empty', display_name: 'Empty', example_text: null, language: 'az' }
        ]
      });

      const csv = await nluImportExport.exportIntentsToCSV(1, 1);

      expect(csv).toContain('empty,Empty,,az');
    });
  });

  describe('exportIntentsToJSON()', () => {
    it('should export intents to JSON format', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'greeting', display_name: 'Greeting', description: 'Greet users' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { text: 'Hello', language: 'az' },
            { text: 'Hi', language: 'en' }
          ]
        });

      const json = await nluImportExport.exportIntentsToJSON(1, 1);

      expect(json).toHaveLength(1);
      expect(json[0].name).toBe('greeting');
      expect(json[0].examples).toHaveLength(2);
    });
  });

  describe('importEntitiesFromCSV()', () => {
    it('should import entities from CSV data', async () => {
      const csvData = `entity_name,display_name,type,value,synonyms
city,City,list,Baku,"Bakı,AZ"
city,City,list,London,"UK capital"`;

      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check entity
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Create entity
        .mockResolvedValueOnce({ rows: [] }) // Check value 1
        .mockResolvedValueOnce({ rows: [] }) // Insert value 1
        .mockResolvedValueOnce({ rows: [] }) // Check value 2
        .mockResolvedValueOnce({ rows: [] }); // Insert value 2

      const result = await nluImportExport.importEntitiesFromCSV(1, csvData, 1);

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should throw error for missing required fields', async () => {
      const csvData = `entity_name,display_name
city,City`;

      await expect(
        nluImportExport.importEntitiesFromCSV(1, csvData, 1)
      ).rejects.toThrow('Missing required field: value');
    });

    it('should handle default type', async () => {
      const csvData = `entity_name,value
city,Baku`;

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await nluImportExport.importEntitiesFromCSV(1, csvData, 1);

      expect(result.imported).toBe(1);
    });
  });

  describe('importEntitiesFromJSON()', () => {
    it('should import entities from JSON data', async () => {
      const jsonData = [
        {
          name: 'city',
          display_name: 'City',
          type: 'list',
          values: [
            { value: 'Baku', synonyms: ['Bakı'] },
            { value: 'London', synonyms: [] }
          ]
        }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check entity
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Create entity
        .mockResolvedValueOnce({ rows: [] }) // Check value 1
        .mockResolvedValueOnce({ rows: [] }) // Insert value 1
        .mockResolvedValueOnce({ rows: [] }) // Check value 2
        .mockResolvedValueOnce({ rows: [] }); // Insert value 2

      const result = await nluImportExport.importEntitiesFromJSON(1, jsonData, 1);

      expect(result.imported).toBe(1);
    });

    it('should handle string values', async () => {
      const jsonData = [
        {
          name: 'city',
          values: ['Baku', 'London']
        }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await nluImportExport.importEntitiesFromJSON(1, jsonData, 1);

      expect(result.imported).toBe(1);
    });

    it('should update existing entity', async () => {
      const jsonData = [{
        name: 'city',
        display_name: 'Updated City',
        type: 'regex'
      }];

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Entity exists
        .mockResolvedValueOnce({ rows: [] }); // Update

      const result = await nluImportExport.importEntitiesFromJSON(1, jsonData, 1);

      expect(result.updated).toBe(1);
    });
  });

  describe('exportEntitiesToCSV()', () => {
    it('should export entities to CSV format', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { entity_name: 'city', display_name: 'City', type: 'list', value: 'Baku', synonyms: ['Bakı', 'AZ'] },
          { entity_name: 'city', display_name: 'City', type: 'list', value: 'London', synonyms: null }
        ]
      });

      const csv = await nluImportExport.exportEntitiesToCSV(1, 1);

      expect(csv).toContain('entity_name,display_name,type,value,synonyms');
      expect(csv).toContain('city,City,list,Baku');
    });

    it('should handle entities without values', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { entity_name: 'empty', display_name: 'Empty', type: 'list', value: null, synonyms: null }
        ]
      });

      const csv = await nluImportExport.exportEntitiesToCSV(1, 1);

      expect(csv).toContain('empty,Empty,list,,');
    });
  });

  describe('exportEntitiesToJSON()', () => {
    it('should export entities to JSON format', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'city', display_name: 'City', type: 'list' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { value: 'Baku', synonyms: ['Bakı'] },
            { value: 'London', synonyms: [] }
          ]
        });

      const json = await nluImportExport.exportEntitiesToJSON(1, 1);

      expect(json).toHaveLength(1);
      expect(json[0].name).toBe('city');
      expect(json[0].values).toHaveLength(2);
    });
  });

  describe('parseCSVLine()', () => {
    it('should parse simple CSV line', () => {
      const result = nluImportExport.parseCSVLine('a,b,c');

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted values', () => {
      const result = nluImportExport.parseCSVLine('a,"b,c",d');

      expect(result).toEqual(['a', 'b,c', 'd']);
    });

    it('should handle empty values', () => {
      const result = nluImportExport.parseCSVLine('a,,c');

      expect(result).toEqual(['a', '', 'c']);
    });
  });

  describe('escapeCSV()', () => {
    it('should return empty string for null', () => {
      expect(nluImportExport.escapeCSV(null)).toBe('');
    });

    it('should escape values with commas', () => {
      expect(nluImportExport.escapeCSV('a,b')).toBe('"a,b"');
    });

    it('should escape values with quotes', () => {
      expect(nluImportExport.escapeCSV('a"b')).toBe('"a""b"');
    });

    it('should escape values with newlines', () => {
      expect(nluImportExport.escapeCSV('a\nb')).toBe('"a\nb"');
    });

    it('should return value unchanged if no special chars', () => {
      expect(nluImportExport.escapeCSV('simple')).toBe('simple');
    });
  });
});

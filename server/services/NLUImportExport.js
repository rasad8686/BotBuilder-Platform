const db = require('../db');

class NLUImportExport {
  /**
   * Import intents from CSV data
   * CSV Format: intent_name,display_name,example_text,language
   */
  async importIntentsFromCSV(botId, csvData, organizationId) {
    const lines = csvData.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());

    // Validate header
    const requiredFields = ['intent_name', 'display_name', 'example_text'];
    for (const field of requiredFields) {
      if (!header.includes(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const nameIdx = header.indexOf('intent_name');
    const displayIdx = header.indexOf('display_name');
    const exampleIdx = header.indexOf('example_text');
    const langIdx = header.indexOf('language');

    const results = { imported: 0, updated: 0, errors: [] };
    const intentCache = new Map();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);
        const intentName = values[nameIdx]?.trim();
        const displayName = values[displayIdx]?.trim();
        const exampleText = values[exampleIdx]?.trim();
        const language = langIdx >= 0 ? values[langIdx]?.trim() || 'az' : 'az';

        if (!intentName || !exampleText) {
          results.errors.push({ line: i + 1, error: 'Missing intent_name or example_text' });
          continue;
        }

        // Get or create intent
        let intentId = intentCache.get(intentName);
        if (!intentId) {
          const existingIntent = await db.query(
            'SELECT id FROM intents WHERE bot_id = $1 AND name = $2 AND organization_id = $3',
            [botId, intentName, organizationId]
          );

          if (existingIntent.rows.length > 0) {
            intentId = existingIntent.rows[0].id;
            results.updated++;
          } else {
            const newIntent = await db.query(
              `INSERT INTO intents (bot_id, organization_id, name, display_name, description)
               VALUES ($1, $2, $3, $4, $5) RETURNING id`,
              [botId, organizationId, intentName, displayName || intentName, '']
            );
            intentId = newIntent.rows[0].id;
            results.imported++;
          }
          intentCache.set(intentName, intentId);
        }

        // Add example (check for duplicates)
        const existingExample = await db.query(
          'SELECT id FROM intent_examples WHERE intent_id = $1 AND text = $2',
          [intentId, exampleText]
        );

        if (existingExample.rows.length === 0) {
          await db.query(
            `INSERT INTO intent_examples (intent_id, text, language) VALUES ($1, $2, $3)`,
            [intentId, exampleText, language]
          );
        }
      } catch (err) {
        results.errors.push({ line: i + 1, error: err.message });
      }
    }

    return results;
  }

  /**
   * Import intents from JSON data
   * JSON Format: [{ name, display_name, examples: [{ text, language }] }]
   */
  async importIntentsFromJSON(botId, jsonData, organizationId) {
    const intents = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    const results = { imported: 0, updated: 0, errors: [] };

    for (const intent of intents) {
      try {
        if (!intent.name) {
          results.errors.push({ intent: intent.name, error: 'Missing intent name' });
          continue;
        }

        // Check if intent exists
        const existingIntent = await db.query(
          'SELECT id FROM intents WHERE bot_id = $1 AND name = $2 AND organization_id = $3',
          [botId, intent.name, organizationId]
        );

        let intentId;
        if (existingIntent.rows.length > 0) {
          intentId = existingIntent.rows[0].id;
          // Update display name if provided
          if (intent.display_name) {
            await db.query(
              'UPDATE intents SET display_name = $1 WHERE id = $2',
              [intent.display_name, intentId]
            );
          }
          results.updated++;
        } else {
          const newIntent = await db.query(
            `INSERT INTO intents (bot_id, organization_id, name, display_name, description)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [botId, organizationId, intent.name, intent.display_name || intent.name, intent.description || '']
          );
          intentId = newIntent.rows[0].id;
          results.imported++;
        }

        // Add examples
        if (intent.examples && Array.isArray(intent.examples)) {
          for (const example of intent.examples) {
            const text = typeof example === 'string' ? example : example.text;
            const language = typeof example === 'string' ? 'az' : (example.language || 'az');

            if (!text) continue;

            const existingExample = await db.query(
              'SELECT id FROM intent_examples WHERE intent_id = $1 AND text = $2',
              [intentId, text]
            );

            if (existingExample.rows.length === 0) {
              await db.query(
                'INSERT INTO intent_examples (intent_id, text, language) VALUES ($1, $2, $3)',
                [intentId, text, language]
              );
            }
          }
        }
      } catch (err) {
        results.errors.push({ intent: intent.name, error: err.message });
      }
    }

    return results;
  }

  /**
   * Export intents to CSV format
   */
  async exportIntentsToCSV(botId, organizationId) {
    const result = await db.query(
      `SELECT i.name as intent_name, i.display_name, ie.text as example_text, ie.language
       FROM intents i
       LEFT JOIN intent_examples ie ON i.id = ie.intent_id
       WHERE i.bot_id = $1 AND i.organization_id = $2
       ORDER BY i.name, ie.id`,
      [botId, organizationId]
    );

    let csv = 'intent_name,display_name,example_text,language\n';
    for (const row of result.rows) {
      csv += `${this.escapeCSV(row.intent_name)},${this.escapeCSV(row.display_name)},${this.escapeCSV(row.example_text || '')},${row.language || 'az'}\n`;
    }

    return csv;
  }

  /**
   * Export intents to JSON format
   */
  async exportIntentsToJSON(botId, organizationId) {
    const intentsResult = await db.query(
      `SELECT id, name, display_name, description FROM intents
       WHERE bot_id = $1 AND organization_id = $2 ORDER BY name`,
      [botId, organizationId]
    );

    const intents = [];
    for (const intent of intentsResult.rows) {
      const examplesResult = await db.query(
        'SELECT text, language FROM intent_examples WHERE intent_id = $1 ORDER BY id',
        [intent.id]
      );

      intents.push({
        name: intent.name,
        display_name: intent.display_name,
        description: intent.description,
        examples: examplesResult.rows
      });
    }

    return intents;
  }

  /**
   * Import entities from CSV data
   * CSV Format: entity_name,display_name,type,value,synonyms
   */
  async importEntitiesFromCSV(botId, csvData, organizationId) {
    const lines = csvData.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());

    const requiredFields = ['entity_name', 'value'];
    for (const field of requiredFields) {
      if (!header.includes(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const nameIdx = header.indexOf('entity_name');
    const displayIdx = header.indexOf('display_name');
    const typeIdx = header.indexOf('type');
    const valueIdx = header.indexOf('value');
    const synonymsIdx = header.indexOf('synonyms');

    const results = { imported: 0, updated: 0, errors: [] };
    const entityCache = new Map();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);
        const entityName = values[nameIdx]?.trim();
        const displayName = displayIdx >= 0 ? values[displayIdx]?.trim() : entityName;
        const entityType = typeIdx >= 0 ? values[typeIdx]?.trim() || 'list' : 'list';
        const value = values[valueIdx]?.trim();
        const synonymsStr = synonymsIdx >= 0 ? values[synonymsIdx]?.trim() : '';
        const synonyms = synonymsStr ? synonymsStr.split(',').map(s => s.trim()) : [];

        if (!entityName || !value) {
          results.errors.push({ line: i + 1, error: 'Missing entity_name or value' });
          continue;
        }

        // Get or create entity
        let entityId = entityCache.get(entityName);
        if (!entityId) {
          const existingEntity = await db.query(
            'SELECT id FROM entities WHERE bot_id = $1 AND name = $2 AND organization_id = $3',
            [botId, entityName, organizationId]
          );

          if (existingEntity.rows.length > 0) {
            entityId = existingEntity.rows[0].id;
            results.updated++;
          } else {
            const newEntity = await db.query(
              `INSERT INTO entities (bot_id, organization_id, name, display_name, type)
               VALUES ($1, $2, $3, $4, $5) RETURNING id`,
              [botId, organizationId, entityName, displayName || entityName, entityType]
            );
            entityId = newEntity.rows[0].id;
            results.imported++;
          }
          entityCache.set(entityName, entityId);
        }

        // Add entity value (check for duplicates)
        const existingValue = await db.query(
          'SELECT id FROM entity_values WHERE entity_id = $1 AND value = $2',
          [entityId, value]
        );

        if (existingValue.rows.length === 0) {
          await db.query(
            `INSERT INTO entity_values (entity_id, value, synonyms) VALUES ($1, $2, $3)`,
            [entityId, value, JSON.stringify(synonyms)]
          );
        }
      } catch (err) {
        results.errors.push({ line: i + 1, error: err.message });
      }
    }

    return results;
  }

  /**
   * Import entities from JSON data
   * JSON Format: [{ name, display_name, type, values: [{ value, synonyms }] }]
   */
  async importEntitiesFromJSON(botId, jsonData, organizationId) {
    const entities = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    const results = { imported: 0, updated: 0, errors: [] };

    for (const entity of entities) {
      try {
        if (!entity.name) {
          results.errors.push({ entity: entity.name, error: 'Missing entity name' });
          continue;
        }

        // Check if entity exists
        const existingEntity = await db.query(
          'SELECT id FROM entities WHERE bot_id = $1 AND name = $2 AND organization_id = $3',
          [botId, entity.name, organizationId]
        );

        let entityId;
        if (existingEntity.rows.length > 0) {
          entityId = existingEntity.rows[0].id;
          if (entity.display_name || entity.type) {
            await db.query(
              'UPDATE entities SET display_name = COALESCE($1, display_name), type = COALESCE($2, type) WHERE id = $3',
              [entity.display_name, entity.type, entityId]
            );
          }
          results.updated++;
        } else {
          const newEntity = await db.query(
            `INSERT INTO entities (bot_id, organization_id, name, display_name, type)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [botId, organizationId, entity.name, entity.display_name || entity.name, entity.type || 'list']
          );
          entityId = newEntity.rows[0].id;
          results.imported++;
        }

        // Add values
        if (entity.values && Array.isArray(entity.values)) {
          for (const val of entity.values) {
            const value = typeof val === 'string' ? val : val.value;
            const synonyms = typeof val === 'string' ? [] : (val.synonyms || []);

            if (!value) continue;

            const existingValue = await db.query(
              'SELECT id FROM entity_values WHERE entity_id = $1 AND value = $2',
              [entityId, value]
            );

            if (existingValue.rows.length === 0) {
              await db.query(
                'INSERT INTO entity_values (entity_id, value, synonyms) VALUES ($1, $2, $3)',
                [entityId, value, JSON.stringify(synonyms)]
              );
            }
          }
        }
      } catch (err) {
        results.errors.push({ entity: entity.name, error: err.message });
      }
    }

    return results;
  }

  /**
   * Export entities to CSV format
   */
  async exportEntitiesToCSV(botId, organizationId) {
    const result = await db.query(
      `SELECT e.name as entity_name, e.display_name, e.type, ev.value, ev.synonyms
       FROM entities e
       LEFT JOIN entity_values ev ON e.id = ev.entity_id
       WHERE e.bot_id = $1 AND e.organization_id = $2
       ORDER BY e.name, ev.id`,
      [botId, organizationId]
    );

    let csv = 'entity_name,display_name,type,value,synonyms\n';
    for (const row of result.rows) {
      const synonyms = row.synonyms ? (Array.isArray(row.synonyms) ? row.synonyms.join(',') : row.synonyms) : '';
      csv += `${this.escapeCSV(row.entity_name)},${this.escapeCSV(row.display_name)},${row.type || 'list'},${this.escapeCSV(row.value || '')},${this.escapeCSV(synonyms)}\n`;
    }

    return csv;
  }

  /**
   * Export entities to JSON format
   */
  async exportEntitiesToJSON(botId, organizationId) {
    const entitiesResult = await db.query(
      `SELECT id, name, display_name, type FROM entities
       WHERE bot_id = $1 AND organization_id = $2 ORDER BY name`,
      [botId, organizationId]
    );

    const entities = [];
    for (const entity of entitiesResult.rows) {
      const valuesResult = await db.query(
        'SELECT value, synonyms FROM entity_values WHERE entity_id = $1 ORDER BY id',
        [entity.id]
      );

      entities.push({
        name: entity.name,
        display_name: entity.display_name,
        type: entity.type,
        values: valuesResult.rows.map(v => ({
          value: v.value,
          synonyms: v.synonyms || []
        }))
      });
    }

    return entities;
  }

  // Helper: Parse CSV line handling quoted values
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  // Helper: Escape CSV value
  escapeCSV(value) {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

module.exports = new NLUImportExport();

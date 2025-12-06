/**
 * Tool Types - Export all tool types with factory function
 */

const HttpTool = require('./HttpTool');
const DatabaseTool = require('./DatabaseTool');
const CodeTool = require('./CodeTool');
const WebScraperTool = require('./WebScraperTool');
const EmailTool = require('./EmailTool');

/**
 * Tool type mapping
 */
const toolTypeMap = {
  'http_request': HttpTool,
  'http': HttpTool,
  'api': HttpTool,
  'database_query': DatabaseTool,
  'database': DatabaseTool,
  'sql': DatabaseTool,
  'code_execution': CodeTool,
  'code': CodeTool,
  'javascript': CodeTool,
  'web_scraper': WebScraperTool,
  'scraper': WebScraperTool,
  'scrape': WebScraperTool,
  'email': EmailTool,
  'smtp': EmailTool,
  'mail': EmailTool
};

/**
 * Create tool instance by type
 * @param {string} type - Tool type
 * @param {Object} config - Tool configuration
 * @returns {Object} - Tool instance
 */
function createTool(type, config = {}) {
  const ToolClass = toolTypeMap[type.toLowerCase()];

  if (!ToolClass) {
    throw new Error(`Unknown tool type: ${type}. Available types: ${Object.keys(toolTypeMap).join(', ')}`);
  }

  return new ToolClass(config);
}

/**
 * Get tool class by type
 * @param {string} type - Tool type
 * @returns {Class} - Tool class
 */
function getToolClass(type) {
  return toolTypeMap[type.toLowerCase()] || null;
}

/**
 * Get available tool types
 * @returns {Array} - Array of unique tool types with info
 */
function getAvailableTypes() {
  const uniqueTypes = new Map();

  // Map primary types to their classes
  const primaryTypes = {
    'http_request': HttpTool,
    'database_query': DatabaseTool,
    'code_execution': CodeTool,
    'web_scraper': WebScraperTool,
    'email': EmailTool
  };

  for (const [type, ToolClass] of Object.entries(primaryTypes)) {
    uniqueTypes.set(type, {
      type,
      name: ToolClass.name,
      inputSchema: ToolClass.getInputSchema(),
      outputSchema: ToolClass.getOutputSchema(),
      configSchema: ToolClass.getConfigSchema()
    });
  }

  return Array.from(uniqueTypes.values());
}

/**
 * Get schema for a tool type
 * @param {string} type - Tool type
 * @returns {Object} - Schemas object
 */
function getToolSchemas(type) {
  const ToolClass = toolTypeMap[type.toLowerCase()];

  if (!ToolClass) {
    return null;
  }

  return {
    input: ToolClass.getInputSchema(),
    output: ToolClass.getOutputSchema(),
    config: ToolClass.getConfigSchema()
  };
}

/**
 * Validate tool type
 * @param {string} type - Tool type
 * @returns {boolean} - Whether type is valid
 */
function isValidType(type) {
  return type && toolTypeMap.hasOwnProperty(type.toLowerCase());
}

module.exports = {
  // Tool classes
  HttpTool,
  DatabaseTool,
  CodeTool,
  WebScraperTool,
  EmailTool,

  // Mapping and factory
  toolTypeMap,
  createTool,
  getToolClass,
  getAvailableTypes,
  getToolSchemas,
  isValidType
};

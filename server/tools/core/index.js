/**
 * Tool System Core - Export all core classes
 */

const ToolRegistry = require('./ToolRegistry');
const ToolExecutor = require('./ToolExecutor');

// Create singleton instances
const toolRegistry = new ToolRegistry();
const toolExecutor = new ToolExecutor();

module.exports = {
  ToolRegistry,
  ToolExecutor,
  toolRegistry,
  toolExecutor
};

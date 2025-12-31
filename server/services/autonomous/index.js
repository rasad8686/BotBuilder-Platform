/**
 * Autonomous Agents Service Index
 * Exports all autonomous agent related services
 */

const AgentCore = require('./AgentCore');
const TaskExecutor = require('./TaskExecutor');
const ToolRegistry = require('./ToolRegistry');
const AgentOrchestrator = require('./AgentOrchestrator');
const AgentMemory = require('./AgentMemory');
const AgentScheduler = require('./AgentScheduler');
const AgentAnalytics = require('./AgentAnalytics');
const AgentTemplates = require('./AgentTemplates');

// Tool imports
const { HttpTool, EmailTool, BrowserTool, FileTool } = require('./tools');

// Integration imports
const {
  SlackIntegration,
  GoogleCalendarIntegration,
  GmailIntegration,
  CRMIntegration
} = require('./integrations');

module.exports = {
  // Core services
  AgentCore,
  TaskExecutor,
  ToolRegistry,

  // Orchestration & Coordination
  AgentOrchestrator,

  // Memory Management
  AgentMemory,

  // Scheduling
  AgentScheduler,

  // Analytics & Metrics
  AgentAnalytics,

  // Templates
  AgentTemplates,

  // Tools
  tools: {
    HttpTool,
    EmailTool,
    BrowserTool,
    FileTool
  },

  // Integrations
  integrations: {
    SlackIntegration,
    GoogleCalendarIntegration,
    GmailIntegration,
    CRMIntegration
  }
};

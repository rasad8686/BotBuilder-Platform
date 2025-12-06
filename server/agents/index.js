/**
 * Multi-Agent AI System - Main exports
 */

const Agent = require('./core/Agent');
const AgentContext = require('./core/AgentContext');
const AgentRegistry = require('./core/AgentRegistry');
const AgentExecutor = require('./core/AgentExecutor');
const AgentOrchestrator = require('./core/AgentOrchestrator');

// Agent Types
const {
  OrchestratorAgent,
  ResearcherAgent,
  WriterAgent,
  AnalyzerAgent,
  ReviewerAgent,
  RouterAgent,
  CustomAgent
} = require('./types');

// Workflows
const {
  WorkflowEngine,
  WorkflowParser,
  WorkflowTemplates
} = require('./workflows');

// Communication
const {
  MessageBus,
  ContextManager
} = require('./communication');

module.exports = {
  // Core
  Agent,
  AgentContext,
  AgentRegistry,
  AgentExecutor,
  AgentOrchestrator,

  // Types
  OrchestratorAgent,
  ResearcherAgent,
  WriterAgent,
  AnalyzerAgent,
  ReviewerAgent,
  RouterAgent,
  CustomAgent,

  // Workflows
  WorkflowEngine,
  WorkflowParser,
  WorkflowTemplates,

  // Communication
  MessageBus,
  ContextManager
};

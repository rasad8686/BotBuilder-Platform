/**
 * Integration exports for Autonomous Agents
 */

const SlackIntegration = require('./SlackIntegration');
const GoogleCalendarIntegration = require('./GoogleCalendarIntegration');
const GmailIntegration = require('./GmailIntegration');
const CRMIntegration = require('./CRMIntegration');

// Integration registry
const integrations = {
  slack: SlackIntegration,
  google_calendar: GoogleCalendarIntegration,
  gmail: GmailIntegration,
  crm: CRMIntegration,
  hubspot: CRMIntegration,
  pipedrive: CRMIntegration
};

/**
 * Get integration class by type
 */
function getIntegrationClass(type) {
  return integrations[type] || null;
}

/**
 * Create integration instance
 */
function createIntegration(type, credentials) {
  const IntegrationClass = getIntegrationClass(type);
  if (!IntegrationClass) {
    throw new Error(`Unknown integration type: ${type}`);
  }
  return new IntegrationClass(credentials);
}

/**
 * Get all available integration types
 */
function getAvailableIntegrations() {
  return [
    {
      type: 'slack',
      name: 'Slack',
      description: 'Send messages and manage channels',
      icon: '💬',
      category: 'communication',
      actions: SlackIntegration.getAvailableActions()
    },
    {
      type: 'google_calendar',
      name: 'Google Calendar',
      description: 'Manage calendar events and schedules',
      icon: '📅',
      category: 'productivity',
      actions: GoogleCalendarIntegration.getAvailableActions()
    },
    {
      type: 'gmail',
      name: 'Gmail',
      description: 'Read and send emails',
      icon: '📧',
      category: 'communication',
      actions: GmailIntegration.getAvailableActions()
    },
    {
      type: 'crm',
      name: 'CRM',
      description: 'Manage contacts and deals (HubSpot, Pipedrive)',
      icon: '👥',
      category: 'sales',
      providers: ['hubspot', 'pipedrive'],
      actions: CRMIntegration.getAvailableActions()
    }
  ];
}

module.exports = {
  SlackIntegration,
  GoogleCalendarIntegration,
  GmailIntegration,
  CRMIntegration,
  getIntegrationClass,
  createIntegration,
  getAvailableIntegrations
};

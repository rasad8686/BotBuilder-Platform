/**
 * Action Builder Component
 * Build actions for automation rules
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trash2,
  GripVertical,
  Settings,
  User,
  Tag,
  Mail,
  MessageSquare,
  Bell,
  ArrowUpCircle,
  Clock,
  FileText,
  Globe,
  Zap,
} from 'lucide-react';

const ACTION_TYPES = [
  { value: 'set_status', label: 'Set Status', icon: Settings, group: 'update' },
  { value: 'set_priority', label: 'Set Priority', icon: ArrowUpCircle, group: 'update' },
  { value: 'assign_to', label: 'Assign To User', icon: User, group: 'assign' },
  { value: 'assign_to_team', label: 'Assign To Team', icon: User, group: 'assign' },
  { value: 'auto_assign', label: 'Auto Assign', icon: Zap, group: 'assign' },
  { value: 'add_tag', label: 'Add Tag', icon: Tag, group: 'update' },
  { value: 'remove_tag', label: 'Remove Tag', icon: Tag, group: 'update' },
  { value: 'set_category', label: 'Set Category', icon: FileText, group: 'update' },
  { value: 'add_comment', label: 'Add Comment', icon: MessageSquare, group: 'communicate' },
  { value: 'add_internal_note', label: 'Add Internal Note', icon: FileText, group: 'communicate' },
  { value: 'send_email', label: 'Send Email', icon: Mail, group: 'communicate' },
  { value: 'send_notification', label: 'Send Notification', icon: Bell, group: 'communicate' },
  { value: 'send_webhook', label: 'Send Webhook', icon: Globe, group: 'integrate' },
  { value: 'escalate', label: 'Escalate', icon: ArrowUpCircle, group: 'escalate' },
  { value: 'set_sla_policy', label: 'Set SLA Policy', icon: Clock, group: 'update' },
  { value: 'set_custom_field', label: 'Set Custom Field', icon: Settings, group: 'update' },
];

const ACTION_GROUPS = [
  { key: 'update', label: 'Update Ticket' },
  { key: 'assign', label: 'Assignment' },
  { key: 'communicate', label: 'Communication' },
  { key: 'escalate', label: 'Escalation' },
  { key: 'integrate', label: 'Integrations' },
];

const ActionBuilder = ({ action, onChange, onRemove }) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    // Fetch users, teams, and templates for dropdowns
    fetchUsers();
    fetchTeams();
    fetchTemplates();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users?role=agent');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/ticket-automation/email-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const selectedAction = ACTION_TYPES.find(a => a.value === action.type) || ACTION_TYPES[0];
  const ActionIcon = selectedAction.icon;

  const handleTypeChange = (newType) => {
    onChange({ type: newType, value: '' });
  };

  const handleValueChange = (newValue) => {
    onChange({ ...action, value: newValue });
  };

  const handleConfigChange = (key, newValue) => {
    onChange({
      ...action,
      config: { ...action.config, [key]: newValue }
    });
  };

  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 pt-2 cursor-move text-gray-400">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-shrink-0 pt-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <ActionIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {/* Action Type Select */}
          <select
            value={action.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            {ACTION_GROUPS.map((group) => (
              <optgroup key={group.key} label={t(`tickets.automation.actionGroup.${group.key}`, group.label)}>
                {ACTION_TYPES.filter(a => a.group === group.key).map((actionType) => (
                  <option key={actionType.value} value={actionType.value}>
                    {t(`tickets.automation.action.${actionType.value}`, actionType.label)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Action Value Input */}
          <ActionValueInput
            actionType={action.type}
            value={action.value}
            config={action.config}
            onChange={handleValueChange}
            onConfigChange={handleConfigChange}
            users={users}
            teams={teams}
            templates={templates}
            t={t}
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * Action Value Input Component
 */
const ActionValueInput = ({
  actionType,
  value,
  config = {},
  onChange,
  onConfigChange,
  users,
  teams,
  templates,
  t,
}) => {
  switch (actionType) {
    case 'set_status':
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">{t('common.select', 'Select...')}</option>
          <option value="open">{t('tickets.status.open', 'Open')}</option>
          <option value="pending">{t('tickets.status.pending', 'Pending')}</option>
          <option value="in_progress">{t('tickets.status.in_progress', 'In Progress')}</option>
          <option value="resolved">{t('tickets.status.resolved', 'Resolved')}</option>
          <option value="closed">{t('tickets.status.closed', 'Closed')}</option>
        </select>
      );

    case 'set_priority':
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">{t('common.select', 'Select...')}</option>
          <option value="low">{t('tickets.priority.low', 'Low')}</option>
          <option value="medium">{t('tickets.priority.medium', 'Medium')}</option>
          <option value="high">{t('tickets.priority.high', 'High')}</option>
          <option value="critical">{t('tickets.priority.critical', 'Critical')}</option>
        </select>
      );

    case 'assign_to':
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">{t('tickets.automation.selectUser', 'Select user...')}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>
      );

    case 'assign_to_team':
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">{t('tickets.automation.selectTeam', 'Select team...')}</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      );

    case 'auto_assign':
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="round_robin">{t('tickets.automation.roundRobin', 'Round Robin')}</option>
          <option value="least_busy">{t('tickets.automation.leastBusy', 'Least Busy')}</option>
          <option value="load_balanced">{t('tickets.automation.loadBalanced', 'Load Balanced')}</option>
          <option value="skill_based">{t('tickets.automation.skillBased', 'Skill Based')}</option>
        </select>
      );

    case 'add_tag':
    case 'remove_tag':
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('tickets.automation.enterTag', 'Enter tag name...')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      );

    case 'add_comment':
    case 'add_internal_note':
      return (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder={t('tickets.automation.enterComment', 'Enter comment text...')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <p className="text-xs text-gray-500">
            {t('tickets.automation.variablesHint', 'Use {{ticket.subject}}, {{requester.name}}, etc.')}
          </p>
        </div>
      );

    case 'send_email':
      return (
        <div className="space-y-2">
          <select
            value={config.template_id || ''}
            onChange={(e) => onConfigChange('template_id', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="">{t('tickets.automation.selectTemplate', 'Select email template...')}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="requester">{t('tickets.automation.sendToRequester', 'Send to Requester')}</option>
            <option value="assignee">{t('tickets.automation.sendToAssignee', 'Send to Assignee')}</option>
            <option value="custom">{t('tickets.automation.sendToCustom', 'Send to Custom Email')}</option>
          </select>
          {value === 'custom' && (
            <input
              type="email"
              value={config.email || ''}
              onChange={(e) => onConfigChange('email', e.target.value)}
              placeholder={t('tickets.automation.enterEmail', 'Enter email address...')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          )}
        </div>
      );

    case 'send_notification':
      return (
        <div className="space-y-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="assignee">{t('tickets.automation.notifyAssignee', 'Notify Assignee')}</option>
            <option value="team">{t('tickets.automation.notifyTeam', 'Notify Team')}</option>
            <option value="admins">{t('tickets.automation.notifyAdmins', 'Notify Admins')}</option>
          </select>
          <input
            type="text"
            value={config.message || ''}
            onChange={(e) => onConfigChange('message', e.target.value)}
            placeholder={t('tickets.automation.notificationMessage', 'Notification message...')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      );

    case 'send_webhook':
      return (
        <div className="space-y-2">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('tickets.automation.webhookUrl', 'https://example.com/webhook')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <select
            value={config.method || 'POST'}
            onChange={(e) => onConfigChange('method', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>
      );

    case 'escalate':
      return (
        <div className="space-y-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="next_level">{t('tickets.automation.escalateNextLevel', 'Escalate to Next Level')}</option>
            <option value="manager">{t('tickets.automation.escalateManager', 'Escalate to Manager')}</option>
            <option value="specific_user">{t('tickets.automation.escalateSpecificUser', 'Escalate to Specific User')}</option>
          </select>
          {value === 'specific_user' && (
            <select
              value={config.user_id || ''}
              onChange={(e) => onConfigChange('user_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">{t('tickets.automation.selectUser', 'Select user...')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          )}
        </div>
      );

    case 'set_custom_field':
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={config.field_name || ''}
            onChange={(e) => onConfigChange('field_name', e.target.value)}
            placeholder={t('tickets.automation.fieldName', 'Field name')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('tickets.automation.fieldValue', 'Field value')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('tickets.automation.enterValue', 'Enter value...')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      );
  }
};

export default ActionBuilder;

/**
 * Escalation Rule Editor Component
 * Edit individual escalation rules with levels
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUp,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Users,
  User,
  Bell,
  Mail,
  MessageSquare,
  Phone,
  AlertTriangle,
} from 'lucide-react';

const NOTIFICATION_CHANNELS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'slack', label: 'Slack', icon: MessageSquare },
  { value: 'sms', label: 'SMS', icon: Phone },
  { value: 'push', label: 'Push Notification', icon: Bell },
];

const ASSIGNEE_TYPES = [
  { value: 'user', label: 'Specific User', icon: User },
  { value: 'team', label: 'Team', icon: Users },
  { value: 'manager', label: 'Manager', icon: ArrowUp },
  { value: 'on_call', label: 'On-Call Agent', icon: Clock },
];

const EscalationRuleEditor = ({ levels = [], onChange, users = [], teams = [] }) => {
  const { t } = useTranslation();
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleAddLevel = () => {
    const lastLevel = levels[levels.length - 1];
    const newThreshold = lastLevel ? lastLevel.time_threshold_minutes + 60 : 30;

    onChange([
      ...levels,
      {
        id: Date.now().toString(),
        time_threshold_minutes: newThreshold,
        assignee_type: 'manager',
        assignee_id: null,
        notify: ['email'],
        message_template: '',
        escalation_reason: '',
      },
    ]);
  };

  const handleRemoveLevel = (index) => {
    if (levels.length <= 1) return;
    onChange(levels.filter((_, i) => i !== index));
  };

  const handleLevelChange = (index, field, value) => {
    const newLevels = [...levels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    onChange(newLevels);
  };

  const handleNotifyToggle = (index, channel) => {
    const newLevels = [...levels];
    const notify = newLevels[index].notify || [];
    if (notify.includes(channel)) {
      newLevels[index].notify = notify.filter(n => n !== channel);
    } else {
      newLevels[index].notify = [...notify, channel];
    }
    onChange(newLevels);
  };

  // Drag and drop handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newLevels = [...levels];
    const draggedItem = newLevels[draggedIndex];
    newLevels.splice(draggedIndex, 1);
    newLevels.splice(index, 0, draggedItem);
    onChange(newLevels);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUp className="w-5 h-5 text-orange-500" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            {t('tickets.escalation.levelsTitle', 'Escalation Levels')}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleAddLevel}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('tickets.escalation.addLevel', 'Add Level')}
        </button>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          {t('tickets.escalation.levelsInfo', 'Escalation levels are processed in order. The ticket will be escalated to the next level if the previous level conditions are not met within the time threshold.')}
        </p>
      </div>

      {/* Levels */}
      <div className="space-y-3">
        {levels.map((level, index) => (
          <div
            key={level.id || index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative bg-white dark:bg-gray-800 rounded-lg border ${
              draggedIndex === index
                ? 'border-blue-500 shadow-lg'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {/* Level Header */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="cursor-move text-gray-400 hover:text-gray-600">
                <GripVertical className="w-5 h-5" />
              </div>

              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold text-sm">
                {index + 1}
              </div>

              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {t('tickets.escalation.level', 'Level')} {index + 1}
                </h4>
              </div>

              {levels.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveLevel(index)}
                  className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Level Content */}
            <div className="p-4 space-y-4">
              {/* Time Threshold */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('tickets.escalation.timeThreshold', 'Time Threshold')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={level.time_threshold_minutes || 30}
                      onChange={(e) => handleLevelChange(index, 'time_threshold_minutes', parseInt(e.target.value))}
                      className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {t('common.minutes', 'minutes')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatTimeDisplay(level.time_threshold_minutes || 30)}
                  </p>
                </div>

                {/* Assignee Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('tickets.escalation.assignTo', 'Assign To')}
                  </label>
                  <select
                    value={level.assignee_type || 'manager'}
                    onChange={(e) => handleLevelChange(index, 'assignee_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    {ASSIGNEE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {t(`tickets.escalation.assigneeType.${type.value}`, type.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Specific User/Team Selection */}
              {(level.assignee_type === 'user' || level.assignee_type === 'team') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {level.assignee_type === 'user'
                      ? t('tickets.escalation.selectUser', 'Select User')
                      : t('tickets.escalation.selectTeam', 'Select Team')
                    }
                  </label>
                  <select
                    value={level.assignee_id || ''}
                    onChange={(e) => handleLevelChange(index, 'assignee_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">{t('common.select', 'Select...')}</option>
                    {level.assignee_type === 'user' && users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                    {level.assignee_type === 'team' && teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notification Channels */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('tickets.escalation.notifications', 'Notification Channels')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {NOTIFICATION_CHANNELS.map((channel) => {
                    const isActive = (level.notify || []).includes(channel.value);
                    const Icon = channel.icon;

                    return (
                      <button
                        key={channel.value}
                        type="button"
                        onClick={() => handleNotifyToggle(index, channel.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{channel.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Escalation Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.escalation.reason', 'Escalation Reason')} ({t('common.optional', 'optional')})
                </label>
                <input
                  type="text"
                  value={level.escalation_reason || ''}
                  onChange={(e) => handleLevelChange(index, 'escalation_reason', e.target.value)}
                  placeholder={t('tickets.escalation.reasonPlaceholder', 'e.g., No response within SLA')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Custom Message Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.escalation.messageTemplate', 'Message Template')} ({t('common.optional', 'optional')})
                </label>
                <textarea
                  value={level.message_template || ''}
                  onChange={(e) => handleLevelChange(index, 'message_template', e.target.value)}
                  rows={2}
                  placeholder={t('tickets.escalation.messageTemplatePlaceholder', 'Custom notification message...')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('tickets.escalation.variablesHint', 'Available variables: {{ticket.id}}, {{ticket.subject}}, {{requester.name}}, {{assignee.name}}')}
                </p>
              </div>
            </div>

            {/* Level Connector */}
            {index < levels.length - 1 && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
                <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <ArrowUp className="w-3 h-3 text-gray-500 dark:text-gray-400 rotate-180" />
                </div>
                <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Level Button */}
      {levels.length === 0 && (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <ArrowUp className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400 mb-3">
            {t('tickets.escalation.noLevels', 'No escalation levels configured')}
          </p>
          <button
            type="button"
            onClick={handleAddLevel}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('tickets.escalation.addFirstLevel', 'Add First Level')}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Format time display
 */
function formatTimeDisplay(minutes) {
  if (minutes < 60) {
    return `${minutes} minutes`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} hour(s) ${mins} minute(s)` : `${hours} hour(s)`;
  } else {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return hours > 0 ? `${days} day(s) ${hours} hour(s)` : `${days} day(s)`;
  }
}

export default EscalationRuleEditor;

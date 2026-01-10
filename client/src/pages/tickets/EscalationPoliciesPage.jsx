/**
 * Escalation Policies Page
 * Manage ticket escalation rules and notifications
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpCircle,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Clock,
  Users,
  Bell,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Copy,
  Search,
  Filter,
  ArrowUp,
  Mail,
  MessageSquare,
} from 'lucide-react';

const EscalationPoliciesPage = () => {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ticket-automation/escalation-policies');
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.policies || []);
      }
    } catch (error) {
      console.error('Error fetching escalation policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (policyId, currentState) => {
    try {
      const response = await fetch(`/api/ticket-automation/escalation-policies/${policyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentState }),
      });
      if (response.ok) {
        setPolicies(policies.map(p =>
          p.id === policyId ? { ...p, is_active: !currentState } : p
        ));
      }
    } catch (error) {
      console.error('Error toggling policy:', error);
    }
  };

  const handleDeletePolicy = async (policyId) => {
    if (!window.confirm(t('tickets.escalation.confirmDelete'))) return;

    try {
      const response = await fetch(`/api/ticket-automation/escalation-policies/${policyId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setPolicies(policies.filter(p => p.id !== policyId));
      }
    } catch (error) {
      console.error('Error deleting policy:', error);
    }
  };

  const handleDuplicatePolicy = async (policy) => {
    try {
      const newPolicy = {
        ...policy,
        name: `${policy.name} (Copy)`,
        is_active: false,
      };
      delete newPolicy.id;
      delete newPolicy.created_at;
      delete newPolicy.updated_at;

      const response = await fetch('/api/ticket-automation/escalation-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPolicy),
      });

      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error('Error duplicating policy:', error);
    }
  };

  const handleSavePolicy = async (policyData) => {
    try {
      const url = editingPolicy
        ? `/api/ticket-automation/escalation-policies/${editingPolicy.id}`
        : '/api/ticket-automation/escalation-policies';

      const method = editingPolicy ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyData),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingPolicy(null);
        fetchPolicies();
      }
    } catch (error) {
      console.error('Error saving policy:', error);
    }
  };

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (policy.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = filterPriority === 'all' || policy.priority === filterPriority;
    return matchesSearch && matchesPriority;
  });

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return colors[priority] || colors.medium;
  };

  const formatTimeThreshold = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowUpCircle className="w-7 h-7 text-orange-500" />
            {t('tickets.escalation.title', 'Escalation Policies')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('tickets.escalation.subtitle', 'Configure automatic ticket escalation rules')}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingPolicy(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('tickets.escalation.addPolicy', 'Add Policy')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('tickets.escalation.searchPolicies', 'Search policies...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('tickets.escalation.allPriorities', 'All Priorities')}</option>
            <option value="critical">{t('tickets.priority.critical', 'Critical')}</option>
            <option value="high">{t('tickets.priority.high', 'High')}</option>
            <option value="medium">{t('tickets.priority.medium', 'Medium')}</option>
            <option value="low">{t('tickets.priority.low', 'Low')}</option>
          </select>
        </div>
      </div>

      {/* Policies List */}
      {filteredPolicies.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <ArrowUpCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('tickets.escalation.noPolicies', 'No escalation policies')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('tickets.escalation.noPoliciesDesc', 'Create your first escalation policy to automatically escalate tickets')}
          </p>
          <button
            onClick={() => {
              setEditingPolicy(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('tickets.escalation.createFirst', 'Create First Policy')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPolicies.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              onEdit={() => {
                setEditingPolicy(policy);
                setShowModal(true);
              }}
              onDelete={() => handleDeletePolicy(policy.id)}
              onToggle={() => handleToggleActive(policy.id, policy.is_active)}
              onDuplicate={() => handleDuplicatePolicy(policy)}
              getPriorityColor={getPriorityColor}
              formatTimeThreshold={formatTimeThreshold}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Policy Modal */}
      {showModal && (
        <PolicyModal
          policy={editingPolicy}
          onClose={() => {
            setShowModal(false);
            setEditingPolicy(null);
          }}
          onSave={handleSavePolicy}
          t={t}
        />
      )}
    </div>
  );
};

/**
 * Policy Card Component
 */
const PolicyCard = ({
  policy,
  onEdit,
  onDelete,
  onToggle,
  onDuplicate,
  getPriorityColor,
  formatTimeThreshold,
  t,
}) => {
  const [expanded, setExpanded] = useState(false);
  const levels = policy.escalation_levels || [];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border ${
      policy.is_active
        ? 'border-gray-200 dark:border-gray-700'
        : 'border-gray-200 dark:border-gray-700 opacity-60'
    } overflow-hidden`}>
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              policy.is_active ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <ArrowUpCircle className={`w-5 h-5 ${
                policy.is_active ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {policy.name}
                <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(policy.priority)}`}>
                  {policy.priority}
                </span>
              </h3>
              {policy.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {policy.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <ArrowUp className="w-4 h-4" />
                  {levels.length} {t('tickets.escalation.levels', 'levels')}
                </span>
                {policy.trigger_type && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {policy.trigger_type === 'sla_breach' ? 'SLA Breach' : 'Time Based'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={policy.is_active ? t('common.disable') : t('common.enable')}
            >
              {policy.is_active ? (
                <ToggleRight className="w-6 h-6 text-green-600" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-400" />
              )}
            </button>
            <button
              onClick={onDuplicate}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('common.duplicate')}
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('common.edit')}
            >
              <Edit2 className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>

        {/* Expand/Collapse */}
        {levels.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            {expanded ? t('common.hideDetails') : t('common.showDetails')}
          </button>
        )}
      </div>

      {/* Escalation Levels */}
      {expanded && levels.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('tickets.escalation.levelsTitle', 'Escalation Levels')}
          </h4>
          <div className="space-y-3">
            {levels.map((level, index) => (
              <EscalationLevelDisplay
                key={index}
                level={level}
                index={index}
                formatTimeThreshold={formatTimeThreshold}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Escalation Level Display
 */
const EscalationLevelDisplay = ({ level, index, formatTimeThreshold, t }) => {
  return (
    <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
        <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            {t('tickets.escalation.after', 'After')} {formatTimeThreshold(level.time_threshold_minutes)}
          </span>
          <span className="text-gray-400">|</span>
          <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
            <Users className="w-4 h-4" />
            {level.assignee_type === 'user' && t('tickets.escalation.assignToUser', 'Assign to user')}
            {level.assignee_type === 'team' && t('tickets.escalation.assignToTeam', 'Assign to team')}
            {level.assignee_type === 'manager' && t('tickets.escalation.assignToManager', 'Assign to manager')}
          </span>
        </div>
        {level.notify && level.notify.length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Bell className="w-4 h-4 text-gray-400" />
            {level.notify.includes('email') && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                <Mail className="w-3 h-3 inline mr-1" />
                Email
              </span>
            )}
            {level.notify.includes('slack') && (
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                <MessageSquare className="w-3 h-3 inline mr-1" />
                Slack
              </span>
            )}
            {level.notify.includes('sms') && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded">
                SMS
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Policy Modal Component
 */
const PolicyModal = ({ policy, onClose, onSave, t }) => {
  const [formData, setFormData] = useState({
    name: policy?.name || '',
    description: policy?.description || '',
    priority: policy?.priority || 'medium',
    trigger_type: policy?.trigger_type || 'time_based',
    is_active: policy?.is_active !== false,
    escalation_levels: policy?.escalation_levels || [
      { time_threshold_minutes: 60, assignee_type: 'team', assignee_id: null, notify: ['email'] }
    ],
    conditions: policy?.conditions || {},
  });

  const [errors, setErrors] = useState({});

  const handleAddLevel = () => {
    const lastLevel = formData.escalation_levels[formData.escalation_levels.length - 1];
    const newThreshold = lastLevel ? lastLevel.time_threshold_minutes + 60 : 60;

    setFormData({
      ...formData,
      escalation_levels: [
        ...formData.escalation_levels,
        { time_threshold_minutes: newThreshold, assignee_type: 'manager', assignee_id: null, notify: ['email'] }
      ],
    });
  };

  const handleRemoveLevel = (index) => {
    if (formData.escalation_levels.length <= 1) return;

    setFormData({
      ...formData,
      escalation_levels: formData.escalation_levels.filter((_, i) => i !== index),
    });
  };

  const handleLevelChange = (index, field, value) => {
    const newLevels = [...formData.escalation_levels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    setFormData({ ...formData, escalation_levels: newLevels });
  };

  const handleNotifyChange = (index, channel) => {
    const newLevels = [...formData.escalation_levels];
    const notify = newLevels[index].notify || [];
    if (notify.includes(channel)) {
      newLevels[index].notify = notify.filter(n => n !== channel);
    } else {
      newLevels[index].notify = [...notify, channel];
    }
    setFormData({ ...formData, escalation_levels: newLevels });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = t('validation.required');
    }
    if (formData.escalation_levels.length === 0) {
      newErrors.levels = t('tickets.escalation.atLeastOneLevel', 'At least one escalation level is required');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {policy ? t('tickets.escalation.editPolicy', 'Edit Escalation Policy') : t('tickets.escalation.createPolicy', 'Create Escalation Policy')}
          </h2>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tickets.escalation.policyName', 'Policy Name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder={t('tickets.escalation.policyNamePlaceholder', 'e.g., Critical Tickets Escalation')}
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tickets.escalation.priority', 'Priority')}
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="critical">{t('tickets.priority.critical', 'Critical')}</option>
                <option value="high">{t('tickets.priority.high', 'High')}</option>
                <option value="medium">{t('tickets.priority.medium', 'Medium')}</option>
                <option value="low">{t('tickets.priority.low', 'Low')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('tickets.escalation.description', 'Description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder={t('tickets.escalation.descriptionPlaceholder', 'Describe when this policy applies...')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('tickets.escalation.triggerType', 'Trigger Type')}
            </label>
            <select
              value={formData.trigger_type}
              onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="time_based">{t('tickets.escalation.timeBased', 'Time Based')}</option>
              <option value="sla_breach">{t('tickets.escalation.slaBreach', 'SLA Breach')}</option>
              <option value="no_response">{t('tickets.escalation.noResponse', 'No Response')}</option>
            </select>
          </div>

          {/* Escalation Levels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('tickets.escalation.levelsTitle', 'Escalation Levels')} *
              </label>
              <button
                type="button"
                onClick={handleAddLevel}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                {t('tickets.escalation.addLevel', 'Add Level')}
              </button>
            </div>
            {errors.levels && <p className="mb-2 text-sm text-red-500">{errors.levels}</p>}

            <div className="space-y-3">
              {formData.escalation_levels.map((level, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {t('tickets.escalation.level', 'Level')} {index + 1}
                    </span>
                    {formData.escalation_levels.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLevel(index)}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('tickets.escalation.timeThreshold', 'Time Threshold (minutes)')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={level.time_threshold_minutes}
                        onChange={(e) => handleLevelChange(index, 'time_threshold_minutes', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('tickets.escalation.assignTo', 'Assign To')}
                      </label>
                      <select
                        value={level.assignee_type}
                        onChange={(e) => handleLevelChange(index, 'assignee_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="user">{t('tickets.escalation.specificUser', 'Specific User')}</option>
                        <option value="team">{t('tickets.escalation.team', 'Team')}</option>
                        <option value="manager">{t('tickets.escalation.manager', 'Manager')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {t('tickets.escalation.notifications', 'Notifications')}
                    </label>
                    <div className="flex items-center gap-3">
                      {['email', 'slack', 'sms'].map((channel) => (
                        <label key={channel} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(level.notify || []).includes(channel)}
                            onChange={() => handleNotifyChange(index, channel)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                            {channel}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {formData.is_active ? t('tickets.escalation.policyActive', 'Policy is active') : t('tickets.escalation.policyInactive', 'Policy is inactive')}
            </span>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {policy ? t('common.save', 'Save') : t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EscalationPoliciesPage;

/**
 * Rule Builder Modal
 * Modal for creating and editing automation rules
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Zap,
  Settings,
  Play,
  Pause,
} from 'lucide-react';
import ConditionBuilder from './ConditionBuilder';
import ActionBuilder from './ActionBuilder';

const TRIGGER_TYPES = [
  { value: 'ticket_created', label: 'Ticket Created', icon: Plus },
  { value: 'ticket_updated', label: 'Ticket Updated', icon: Settings },
  { value: 'ticket_assigned', label: 'Ticket Assigned', icon: Zap },
  { value: 'time_based', label: 'Time Based', icon: Play },
  { value: 'sla_breach', label: 'SLA Breach', icon: AlertCircle },
];

const RuleBuilderModal = ({ rule, onClose, onSave }) => {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'ticket_created',
    conditions: [],
    actions: [],
    is_active: true,
    priority: 10,
    stop_processing: false,
  });

  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('conditions');

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name || '',
        description: rule.description || '',
        trigger_type: rule.trigger_type || 'ticket_created',
        conditions: rule.conditions || [],
        actions: rule.actions || [],
        is_active: rule.is_active !== false,
        priority: rule.priority || 10,
        stop_processing: rule.stop_processing || false,
      });
    }
  }, [rule]);

  const handleAddCondition = () => {
    setFormData({
      ...formData,
      conditions: [
        ...formData.conditions,
        { field: 'status', operator: 'equals', value: '' }
      ],
    });
  };

  const handleRemoveCondition = (index) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index),
    });
  };

  const handleConditionChange = (index, condition) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = condition;
    setFormData({ ...formData, conditions: newConditions });
  };

  const handleAddAction = () => {
    setFormData({
      ...formData,
      actions: [
        ...formData.actions,
        { type: 'set_status', value: '' }
      ],
    });
  };

  const handleRemoveAction = (index) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index),
    });
  };

  const handleActionChange = (index, action) => {
    const newActions = [...formData.actions];
    newActions[index] = action;
    setFormData({ ...formData, actions: newActions });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('validation.required', 'This field is required');
    }

    if (formData.conditions.length === 0) {
      newErrors.conditions = t('tickets.automation.atLeastOneCondition', 'At least one condition is required');
    } else {
      formData.conditions.forEach((cond, i) => {
        if (!cond.value && cond.operator !== 'is_empty' && cond.operator !== 'is_not_empty') {
          newErrors[`condition_${i}`] = t('validation.required');
        }
      });
    }

    if (formData.actions.length === 0) {
      newErrors.actions = t('tickets.automation.atLeastOneAction', 'At least one action is required');
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {rule ? t('tickets.automation.editRule', 'Edit Automation Rule') : t('tickets.automation.createRule', 'Create Automation Rule')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('tickets.automation.ruleDescription', 'Define conditions and actions for automatic ticket handling')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('tickets.automation.ruleName', 'Rule Name')} *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder={t('tickets.automation.ruleNamePlaceholder', 'e.g., Auto-assign urgent tickets')}
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('tickets.automation.triggerType', 'Trigger Type')}
                  </label>
                  <select
                    value={formData.trigger_type}
                    onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    {TRIGGER_TYPES.map((trigger) => (
                      <option key={trigger.value} value={trigger.value}>
                        {t(`tickets.automation.trigger.${trigger.value}`, trigger.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('tickets.automation.description', 'Description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder={t('tickets.automation.descriptionPlaceholder', 'Describe what this rule does...')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('tickets.automation.priority', 'Priority')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('tickets.automation.priorityHint', 'Lower number = higher priority')}</p>
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.stop_processing}
                      onChange={(e) => setFormData({ ...formData, stop_processing: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('tickets.automation.stopProcessing', 'Stop processing other rules')}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('conditions')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'conditions'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t('tickets.automation.conditions', 'Conditions')} ({formData.conditions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('actions')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'actions'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t('tickets.automation.actions', 'Actions')} ({formData.actions.length})
                </button>
              </nav>
            </div>

            {/* Conditions Tab */}
            {activeTab === 'conditions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('tickets.automation.conditionsHint', 'All conditions must be met for the rule to trigger')}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t('tickets.automation.addCondition', 'Add Condition')}
                  </button>
                </div>

                {errors.conditions && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.conditions}
                  </p>
                )}

                {formData.conditions.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <Zap className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {t('tickets.automation.noConditions', 'No conditions added yet')}
                    </p>
                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      {t('tickets.automation.addFirstCondition', 'Add your first condition')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.conditions.map((condition, index) => (
                      <div key={index} className="relative">
                        {index > 0 && (
                          <div className="absolute -top-3 left-4 px-2 bg-white dark:bg-gray-800 text-xs text-gray-500 font-medium">
                            AND
                          </div>
                        )}
                        <ConditionBuilder
                          condition={condition}
                          onChange={(cond) => handleConditionChange(index, cond)}
                          onRemove={() => handleRemoveCondition(index)}
                          error={errors[`condition_${index}`]}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('tickets.automation.actionsHint', 'Actions will be executed in order when conditions are met')}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddAction}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t('tickets.automation.addAction', 'Add Action')}
                  </button>
                </div>

                {errors.actions && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.actions}
                  </p>
                )}

                {formData.actions.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <Play className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {t('tickets.automation.noActions', 'No actions added yet')}
                    </p>
                    <button
                      type="button"
                      onClick={handleAddAction}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      {t('tickets.automation.addFirstAction', 'Add your first action')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.actions.map((action, index) => (
                      <div key={index} className="relative">
                        {index > 0 && (
                          <div className="absolute -top-3 left-4 px-2 bg-white dark:bg-gray-800 text-xs text-gray-500 font-medium">
                            THEN
                          </div>
                        )}
                        <ActionBuilder
                          action={action}
                          onChange={(act) => handleActionChange(index, act)}
                          onRemove={() => handleRemoveAction(index)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Toggle */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                {formData.is_active ? (
                  <>
                    <Play className="w-4 h-4 text-green-500" />
                    {t('tickets.automation.ruleActive', 'Rule is active')}
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 text-gray-500" />
                    {t('tickets.automation.ruleInactive', 'Rule is inactive')}
                  </>
                )}
              </span>
            </div>
          </div>
        </form>

        {/* Footer */}
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {rule ? t('common.save', 'Save') : t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RuleBuilderModal;

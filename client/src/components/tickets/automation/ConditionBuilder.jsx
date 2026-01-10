/**
 * Condition Builder Component
 * Build conditions for automation rules
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, GripVertical } from 'lucide-react';

const CONDITION_FIELDS = [
  { value: 'status', label: 'Status', type: 'select', options: ['open', 'pending', 'in_progress', 'resolved', 'closed'] },
  { value: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
  { value: 'channel', label: 'Channel', type: 'select', options: ['email', 'chat', 'phone', 'web', 'api'] },
  { value: 'category_id', label: 'Category', type: 'category' },
  { value: 'assignee_id', label: 'Assignee', type: 'user' },
  { value: 'requester_email', label: 'Requester Email', type: 'text' },
  { value: 'subject', label: 'Subject', type: 'text' },
  { value: 'description', label: 'Description', type: 'text' },
  { value: 'tags', label: 'Tags', type: 'tags' },
  { value: 'hours_since_created', label: 'Hours Since Created', type: 'number' },
  { value: 'hours_since_updated', label: 'Hours Since Updated', type: 'number' },
  { value: 'hours_until_sla_breach', label: 'Hours Until SLA Breach', type: 'number' },
  { value: 'comment_count', label: 'Comment Count', type: 'number' },
  { value: 'is_escalated', label: 'Is Escalated', type: 'boolean' },
  { value: 'has_attachments', label: 'Has Attachments', type: 'boolean' },
  { value: 'first_response_at', label: 'First Response', type: 'exists' },
];

const OPERATORS = {
  text: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
    { value: 'matches_regex', label: 'matches regex' },
  ],
  select: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'in', label: 'is any of' },
    { value: 'not_in', label: 'is none of' },
  ],
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
    { value: 'greater_or_equal', label: 'greater or equal' },
    { value: 'less_or_equal', label: 'less or equal' },
    { value: 'between', label: 'between' },
  ],
  boolean: [
    { value: 'equals', label: 'is' },
  ],
  exists: [
    { value: 'exists', label: 'exists' },
    { value: 'not_exists', label: 'does not exist' },
  ],
  tags: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'contains_any', label: 'contains any of' },
    { value: 'contains_all', label: 'contains all of' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  user: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'is_empty', label: 'is unassigned' },
    { value: 'is_not_empty', label: 'is assigned' },
  ],
  category: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'in', label: 'is any of' },
  ],
};

const ConditionBuilder = ({ condition, onChange, onRemove, error }) => {
  const { t } = useTranslation();

  const selectedField = CONDITION_FIELDS.find(f => f.value === condition.field) || CONDITION_FIELDS[0];
  const operators = OPERATORS[selectedField.type] || OPERATORS.text;

  const handleFieldChange = (newField) => {
    const field = CONDITION_FIELDS.find(f => f.value === newField);
    const newOperators = OPERATORS[field?.type || 'text'];
    onChange({
      field: newField,
      operator: newOperators[0]?.value || 'equals',
      value: '',
    });
  };

  const handleOperatorChange = (newOperator) => {
    onChange({ ...condition, operator: newOperator });
  };

  const handleValueChange = (newValue) => {
    onChange({ ...condition, value: newValue });
  };

  const needsValue = !['is_empty', 'is_not_empty', 'exists', 'not_exists'].includes(condition.operator);

  return (
    <div className={`p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border ${
      error ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
    }`}>
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 pt-2 cursor-move text-gray-400">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Field Select */}
          <select
            value={condition.field}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            {CONDITION_FIELDS.map((field) => (
              <option key={field.value} value={field.value}>
                {t(`tickets.automation.field.${field.value}`, field.label)}
              </option>
            ))}
          </select>

          {/* Operator Select */}
          <select
            value={condition.operator}
            onChange={(e) => handleOperatorChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            {operators.map((op) => (
              <option key={op.value} value={op.value}>
                {t(`tickets.automation.operator.${op.value}`, op.label)}
              </option>
            ))}
          </select>

          {/* Value Input */}
          {needsValue && (
            <ValueInput
              field={selectedField}
              operator={condition.operator}
              value={condition.value}
              onChange={handleValueChange}
              t={t}
            />
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

/**
 * Value Input Component
 */
const ValueInput = ({ field, operator, value, onChange, t }) => {
  // Multi-select operators
  if (['in', 'not_in', 'contains_any', 'contains_all'].includes(operator)) {
    return (
      <input
        type="text"
        value={Array.isArray(value) ? value.join(', ') : value}
        onChange={(e) => onChange(e.target.value.split(',').map(v => v.trim()))}
        placeholder={t('tickets.automation.commaSeparated', 'Comma separated values')}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  // Between operator (range)
  if (operator === 'between') {
    const rangeValue = typeof value === 'object' ? value : { min: '', max: '' };
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={rangeValue.min || ''}
          onChange={(e) => onChange({ ...rangeValue, min: e.target.value })}
          placeholder={t('common.min', 'Min')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-500">-</span>
        <input
          type="number"
          value={rangeValue.max || ''}
          onChange={(e) => onChange({ ...rangeValue, max: e.target.value })}
          placeholder={t('common.max', 'Max')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  }

  // Select type fields
  if (field.type === 'select' && field.options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{t('common.select', 'Select...')}</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {t(`tickets.${field.value}.${opt}`, opt)}
          </option>
        ))}
      </select>
    );
  }

  // Boolean type
  if (field.type === 'boolean') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === 'true')}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="true">{t('common.yes', 'Yes')}</option>
        <option value="false">{t('common.no', 'No')}</option>
      </select>
    );
  }

  // Number type
  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  // Default: text input
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('tickets.automation.enterValue', 'Enter value...')}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
    />
  );
};

export default ConditionBuilder;

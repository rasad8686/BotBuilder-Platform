import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, GripVertical } from 'lucide-react';

const ListRuleBuilder = ({ rules = [], onChange, readOnly = false }) => {
  const { t } = useTranslation();

  // Available fields for conditions
  const fields = [
    { id: 'email', label: t('email.rules.fieldEmail', 'Email'), type: 'string' },
    { id: 'first_name', label: t('email.rules.fieldFirstName', 'First Name'), type: 'string' },
    { id: 'last_name', label: t('email.rules.fieldLastName', 'Last Name'), type: 'string' },
    { id: 'company', label: t('email.rules.fieldCompany', 'Company'), type: 'string' },
    { id: 'job_title', label: t('email.rules.fieldJobTitle', 'Job Title'), type: 'string' },
    { id: 'status', label: t('email.rules.fieldStatus', 'Status'), type: 'select', options: ['subscribed', 'unsubscribed', 'bounced'] },
    { id: 'source', label: t('email.rules.fieldSource', 'Source'), type: 'select', options: ['manual', 'import', 'chatbot', 'form', 'api'] },
    { id: 'tags', label: t('email.rules.fieldTags', 'Tags'), type: 'tags' },
    { id: 'created_at', label: t('email.rules.fieldCreatedAt', 'Created Date'), type: 'date' },
    { id: 'last_activity', label: t('email.rules.fieldLastActivity', 'Last Activity'), type: 'date' }
  ];

  // Operators based on field type
  const getOperators = (fieldType) => {
    const operators = {
      string: [
        { id: 'equals', label: t('email.rules.opEquals', 'equals') },
        { id: 'not_equals', label: t('email.rules.opNotEquals', 'does not equal') },
        { id: 'contains', label: t('email.rules.opContains', 'contains') },
        { id: 'not_contains', label: t('email.rules.opNotContains', 'does not contain') },
        { id: 'starts_with', label: t('email.rules.opStartsWith', 'starts with') },
        { id: 'ends_with', label: t('email.rules.opEndsWith', 'ends with') },
        { id: 'is_empty', label: t('email.rules.opIsEmpty', 'is empty') },
        { id: 'is_not_empty', label: t('email.rules.opIsNotEmpty', 'is not empty') }
      ],
      select: [
        { id: 'equals', label: t('email.rules.opIs', 'is') },
        { id: 'not_equals', label: t('email.rules.opIsNot', 'is not') }
      ],
      tags: [
        { id: 'contains', label: t('email.rules.opHasTag', 'has tag') },
        { id: 'not_contains', label: t('email.rules.opNotHasTag', 'does not have tag') },
        { id: 'contains_any', label: t('email.rules.opHasAnyTag', 'has any of tags') },
        { id: 'contains_all', label: t('email.rules.opHasAllTags', 'has all tags') }
      ],
      date: [
        { id: 'equals', label: t('email.rules.opOn', 'is on') },
        { id: 'before', label: t('email.rules.opBefore', 'is before') },
        { id: 'after', label: t('email.rules.opAfter', 'is after') },
        { id: 'in_last', label: t('email.rules.opInLast', 'is in the last') },
        { id: 'not_in_last', label: t('email.rules.opNotInLast', 'is not in the last') }
      ]
    };
    return operators[fieldType] || operators.string;
  };

  // Add new rule
  const addRule = () => {
    const newRule = {
      id: Date.now(),
      field: 'email',
      operator: 'contains',
      value: '',
      logic: 'and'
    };
    onChange([...rules, newRule]);
  };

  // Update rule
  const updateRule = (index, updates) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  // Remove rule
  const removeRule = (index) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  // Toggle logic (AND/OR)
  const toggleLogic = (index) => {
    const updated = [...rules];
    updated[index].logic = updated[index].logic === 'and' ? 'or' : 'and';
    onChange(updated);
  };

  // Get field config
  const getField = (fieldId) => fields.find(f => f.id === fieldId) || fields[0];

  return (
    <div className="space-y-4">
      {rules.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('email.rules.noRules', 'No rules defined yet')}
          </p>
          {!readOnly && (
            <button
              onClick={addRule}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              {t('email.rules.addRule', 'Add Rule')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => {
            const field = getField(rule.field);
            const operators = getOperators(field.type);
            const needsValue = !['is_empty', 'is_not_empty'].includes(rule.operator);

            return (
              <div key={rule.id || index}>
                {/* Logic connector */}
                {index > 0 && (
                  <div className="flex items-center justify-center mb-3">
                    {readOnly ? (
                      <span className="px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 rounded-full uppercase">
                        {rule.logic}
                      </span>
                    ) : (
                      <button
                        onClick={() => toggleLogic(index)}
                        className="px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 rounded-full uppercase hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        {rule.logic}
                      </button>
                    )}
                  </div>
                )}

                {/* Rule row */}
                <div className={`
                  flex items-center gap-3 p-4 rounded-lg border
                  ${readOnly
                    ? 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                  }
                `}>
                  {!readOnly && (
                    <div className="text-gray-400 cursor-grab">
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}

                  {/* Field selector */}
                  <select
                    value={rule.field}
                    onChange={(e) => updateRule(index, { field: e.target.value, operator: 'equals', value: '' })}
                    disabled={readOnly}
                    className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm disabled:opacity-60"
                  >
                    {fields.map(f => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>

                  {/* Operator selector */}
                  <select
                    value={rule.operator}
                    onChange={(e) => updateRule(index, { operator: e.target.value })}
                    disabled={readOnly}
                    className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm disabled:opacity-60"
                  >
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>{op.label}</option>
                    ))}
                  </select>

                  {/* Value input */}
                  {needsValue && (
                    <>
                      {field.type === 'select' ? (
                        <select
                          value={rule.value}
                          onChange={(e) => updateRule(index, { value: e.target.value })}
                          disabled={readOnly}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm disabled:opacity-60"
                        >
                          <option value="">{t('email.rules.selectValue', 'Select...')}</option>
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'date' && ['in_last', 'not_in_last'].includes(rule.operator) ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={rule.value}
                            onChange={(e) => updateRule(index, { value: e.target.value })}
                            disabled={readOnly}
                            className="w-20 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm disabled:opacity-60"
                            min="1"
                          />
                          <select
                            value={rule.unit || 'days'}
                            onChange={(e) => updateRule(index, { unit: e.target.value })}
                            disabled={readOnly}
                            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm disabled:opacity-60"
                          >
                            <option value="days">{t('email.rules.days', 'days')}</option>
                            <option value="weeks">{t('email.rules.weeks', 'weeks')}</option>
                            <option value="months">{t('email.rules.months', 'months')}</option>
                          </select>
                        </div>
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          value={rule.value}
                          onChange={(e) => updateRule(index, { value: e.target.value })}
                          disabled={readOnly}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm disabled:opacity-60"
                        />
                      ) : (
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => updateRule(index, { value: e.target.value })}
                          disabled={readOnly}
                          placeholder={t('email.rules.enterValue', 'Enter value...')}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm disabled:opacity-60"
                        />
                      )}
                    </>
                  )}

                  {/* Remove button */}
                  {!readOnly && (
                    <button
                      onClick={() => removeRule(index)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add rule button */}
      {!readOnly && rules.length > 0 && (
        <button
          onClick={addRule}
          className="flex items-center gap-2 px-4 py-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('email.rules.addRule', 'Add Rule')}
        </button>
      )}
    </div>
  );
};

export default ListRuleBuilder;

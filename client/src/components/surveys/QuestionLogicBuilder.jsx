import React, { useState } from 'react';
import {
  GitBranch,
  ArrowRight,
  Plus,
  Trash2,
  ChevronDown,
  AlertCircle,
  Eye,
  EyeOff,
  SkipForward,
  Target,
  Zap,
  Info
} from 'lucide-react';

const QuestionLogicBuilder = ({ questions = [], logic = [], onChange, readonly = false }) => {
  const [expandedRules, setExpandedRules] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const defaultLogic = logic.length > 0 ? logic : [];

  const operators = {
    equals: 'equals',
    not_equals: 'does not equal',
    contains: 'contains',
    greater_than: 'is greater than',
    less_than: 'is less than',
    is_answered: 'is answered',
    is_not_answered: 'is not answered',
    includes: 'includes',
    not_includes: 'does not include'
  };

  const actions = [
    { value: 'skip_to', label: 'Skip to question', icon: SkipForward },
    { value: 'show', label: 'Show question', icon: Eye },
    { value: 'hide', label: 'Hide question', icon: EyeOff },
    { value: 'end_survey', label: 'End survey', icon: Target },
    { value: 'redirect', label: 'Redirect to URL', icon: ArrowRight }
  ];

  const getOperatorsForQuestionType = (questionType) => {
    switch (questionType) {
      case 'nps':
      case 'rating':
      case 'scale':
        return ['equals', 'not_equals', 'greater_than', 'less_than', 'is_answered', 'is_not_answered'];
      case 'single_choice':
      case 'emoji':
        return ['equals', 'not_equals', 'is_answered', 'is_not_answered'];
      case 'multiple_choice':
        return ['includes', 'not_includes', 'is_answered', 'is_not_answered'];
      case 'text':
        return ['contains', 'equals', 'is_answered', 'is_not_answered'];
      default:
        return Object.keys(operators);
    }
  };

  const getValueOptions = (question) => {
    if (!question) return [];

    switch (question.type) {
      case 'nps':
        return Array.from({ length: 11 }, (_, i) => ({ value: i, label: i.toString() }));
      case 'rating':
        return Array.from({ length: question.maxRating || 5 }, (_, i) => ({
          value: i + 1,
          label: `${i + 1} star${i > 0 ? 's' : ''}`
        }));
      case 'scale':
        return Array.from(
          { length: (question.max || 10) - (question.min || 1) + 1 },
          (_, i) => ({ value: (question.min || 1) + i, label: ((question.min || 1) + i).toString() })
        );
      case 'single_choice':
      case 'multiple_choice':
        return (question.options || []).map((opt) => ({ value: opt, label: opt }));
      case 'emoji':
        return [
          { value: 'very_sad', label: 'Very Sad' },
          { value: 'sad', label: 'Sad' },
          { value: 'neutral', label: 'Neutral' },
          { value: 'happy', label: 'Happy' },
          { value: 'very_happy', label: 'Very Happy' }
        ];
      default:
        return [];
    }
  };

  const addRule = () => {
    if (readonly || questions.length < 2) return;

    const newRule = {
      id: Date.now(),
      conditions: [
        {
          id: Date.now() + 1,
          questionId: questions[0]?.id || '',
          operator: 'equals',
          value: ''
        }
      ],
      conditionLogic: 'and', // 'and' or 'or'
      action: 'skip_to',
      targetQuestionId: '',
      redirectUrl: ''
    };

    const updated = [...defaultLogic, newRule];
    onChange?.(updated);
    setExpandedRules([...expandedRules, newRule.id]);
  };

  const updateRule = (ruleId, field, value) => {
    if (readonly) return;
    const updated = defaultLogic.map((rule) =>
      rule.id === ruleId ? { ...rule, [field]: value } : rule
    );
    onChange?.(updated);
  };

  const removeRule = (ruleId) => {
    if (readonly) return;
    const updated = defaultLogic.filter((rule) => rule.id !== ruleId);
    onChange?.(updated);
  };

  const addCondition = (ruleId) => {
    if (readonly) return;
    const updated = defaultLogic.map((rule) => {
      if (rule.id === ruleId) {
        return {
          ...rule,
          conditions: [
            ...rule.conditions,
            {
              id: Date.now(),
              questionId: questions[0]?.id || '',
              operator: 'equals',
              value: ''
            }
          ]
        };
      }
      return rule;
    });
    onChange?.(updated);
  };

  const updateCondition = (ruleId, conditionId, field, value) => {
    if (readonly) return;
    const updated = defaultLogic.map((rule) => {
      if (rule.id === ruleId) {
        return {
          ...rule,
          conditions: rule.conditions.map((cond) =>
            cond.id === conditionId ? { ...cond, [field]: value } : cond
          )
        };
      }
      return rule;
    });
    onChange?.(updated);
  };

  const removeCondition = (ruleId, conditionId) => {
    if (readonly) return;
    const updated = defaultLogic.map((rule) => {
      if (rule.id === ruleId) {
        return {
          ...rule,
          conditions: rule.conditions.filter((cond) => cond.id !== conditionId)
        };
      }
      return rule;
    });
    onChange?.(updated);
  };

  const toggleExpanded = (ruleId) => {
    setExpandedRules((prev) =>
      prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId]
    );
  };

  const getQuestionById = (questionId) => questions.find((q) => q.id === questionId);

  const getQuestionLabel = (question, index) => {
    if (!question) return 'Unknown Question';
    const label = question.question || question.title || `Question ${index + 1}`;
    return label.length > 40 ? label.substring(0, 40) + '...' : label;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Conditional Logic</h3>
              <p className="text-sm text-gray-500">Create skip and branching logic for your questions</p>
            </div>
          </div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showPreview ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {questions.length < 2 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="font-medium text-gray-900">Add more questions</h4>
            <p className="text-sm text-gray-500 mt-1">
              You need at least 2 questions to create conditional logic
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Rules */}
            {defaultLogic.map((rule, ruleIndex) => {
              const isExpanded = expandedRules.includes(rule.id);
              const ActionIcon = actions.find((a) => a.value === rule.action)?.icon || ArrowRight;

              return (
                <div
                  key={rule.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Rule Header */}
                  <div
                    className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleExpanded(rule.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center font-medium">
                        {ruleIndex + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          Rule {ruleIndex + 1}: {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          <ActionIcon className="w-4 h-4" />
                          <span>{actions.find((a) => a.value === rule.action)?.label}</span>
                          {rule.action === 'skip_to' && rule.targetQuestionId && (
                            <span>
                              to Q{questions.findIndex((q) => q.id === rule.targetQuestionId) + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!readonly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRule(rule.id);
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Rule Content */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      {/* Conditions */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-700">When</h5>
                          {rule.conditions.length > 1 && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateRule(rule.id, 'conditionLogic', 'and')}
                                disabled={readonly}
                                className={`px-3 py-1 rounded text-sm ${
                                  rule.conditionLogic === 'and'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                AND
                              </button>
                              <button
                                onClick={() => updateRule(rule.id, 'conditionLogic', 'or')}
                                disabled={readonly}
                                className={`px-3 py-1 rounded text-sm ${
                                  rule.conditionLogic === 'or'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                OR
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          {rule.conditions.map((condition, condIndex) => {
                            const selectedQuestion = getQuestionById(condition.questionId);
                            const availableOperators = selectedQuestion
                              ? getOperatorsForQuestionType(selectedQuestion.type)
                              : Object.keys(operators);
                            const valueOptions = selectedQuestion
                              ? getValueOptions(selectedQuestion)
                              : [];
                            const needsValue = !['is_answered', 'is_not_answered'].includes(condition.operator);

                            return (
                              <div key={condition.id} className="flex items-start gap-2">
                                {condIndex > 0 && (
                                  <span className="w-12 text-center py-2 text-sm text-gray-500 uppercase">
                                    {rule.conditionLogic}
                                  </span>
                                )}
                                <div className={`flex-1 grid ${condIndex > 0 ? '' : 'ml-14'} grid-cols-1 md:grid-cols-3 gap-2`}>
                                  {/* Question Select */}
                                  <select
                                    value={condition.questionId}
                                    onChange={(e) => updateCondition(rule.id, condition.id, 'questionId', e.target.value)}
                                    disabled={readonly}
                                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                  >
                                    <option value="">Select question</option>
                                    {questions.map((q, i) => (
                                      <option key={q.id} value={q.id}>
                                        Q{i + 1}: {getQuestionLabel(q, i)}
                                      </option>
                                    ))}
                                  </select>

                                  {/* Operator Select */}
                                  <select
                                    value={condition.operator}
                                    onChange={(e) => updateCondition(rule.id, condition.id, 'operator', e.target.value)}
                                    disabled={readonly}
                                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                  >
                                    {availableOperators.map((op) => (
                                      <option key={op} value={op}>
                                        {operators[op]}
                                      </option>
                                    ))}
                                  </select>

                                  {/* Value Input */}
                                  {needsValue && (
                                    valueOptions.length > 0 ? (
                                      <select
                                        value={condition.value}
                                        onChange={(e) => updateCondition(rule.id, condition.id, 'value', e.target.value)}
                                        disabled={readonly}
                                        className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                      >
                                        <option value="">Select value</option>
                                        {valueOptions.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        value={condition.value}
                                        onChange={(e) => updateCondition(rule.id, condition.id, 'value', e.target.value)}
                                        disabled={readonly}
                                        placeholder="Enter value"
                                        className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                      />
                                    )
                                  )}
                                </div>

                                {rule.conditions.length > 1 && !readonly && (
                                  <button
                                    onClick={() => removeCondition(rule.id, condition.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {!readonly && (
                          <button
                            onClick={() => addCondition(rule.id)}
                            className="mt-3 flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700"
                          >
                            <Plus className="w-4 h-4" />
                            Add condition
                          </button>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-gray-200" />
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>

                      {/* Action */}
                      <div>
                        <h5 className="font-medium text-gray-700 mb-3">Then</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <select
                            value={rule.action}
                            onChange={(e) => updateRule(rule.id, 'action', e.target.value)}
                            disabled={readonly}
                            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          >
                            {actions.map((action) => (
                              <option key={action.value} value={action.value}>
                                {action.label}
                              </option>
                            ))}
                          </select>

                          {(rule.action === 'skip_to' || rule.action === 'show' || rule.action === 'hide') && (
                            <select
                              value={rule.targetQuestionId}
                              onChange={(e) => updateRule(rule.id, 'targetQuestionId', e.target.value)}
                              disabled={readonly}
                              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                            >
                              <option value="">Select target question</option>
                              {questions.map((q, i) => (
                                <option key={q.id} value={q.id}>
                                  Q{i + 1}: {getQuestionLabel(q, i)}
                                </option>
                              ))}
                              {rule.action === 'skip_to' && (
                                <option value="end">End of survey</option>
                              )}
                            </select>
                          )}

                          {rule.action === 'redirect' && (
                            <input
                              type="url"
                              value={rule.redirectUrl}
                              onChange={(e) => updateRule(rule.id, 'redirectUrl', e.target.value)}
                              disabled={readonly}
                              placeholder="https://example.com"
                              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Rule Button */}
            {!readonly && (
              <button
                onClick={addRule}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Logic Rule
              </button>
            )}

            {defaultLogic.length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="font-medium text-gray-900">No logic rules yet</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Add rules to create skip logic and branching in your survey
                </p>
              </div>
            )}
          </div>
        )}

        {/* Logic Preview */}
        {showPreview && defaultLogic.length > 0 && (
          <div className="mt-6 p-4 bg-amber-50 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-900">Logic Flow Preview</h4>
                <div className="mt-3 space-y-2">
                  {defaultLogic.map((rule, index) => (
                    <div key={rule.id} className="text-sm text-amber-700">
                      <span className="font-medium">Rule {index + 1}:</span>{' '}
                      If{' '}
                      {rule.conditions.map((cond, i) => {
                        const q = getQuestionById(cond.questionId);
                        const qIndex = questions.findIndex((qu) => qu.id === cond.questionId);
                        return (
                          <span key={cond.id}>
                            {i > 0 && <span className="uppercase text-amber-600"> {rule.conditionLogic} </span>}
                            Q{qIndex + 1} {operators[cond.operator]} "{cond.value}"
                          </span>
                        );
                      })}{' '}
                      then {actions.find((a) => a.value === rule.action)?.label.toLowerCase()}
                      {rule.action === 'skip_to' && rule.targetQuestionId && (
                        <span>
                          {' '}Q{questions.findIndex((q) => q.id === rule.targetQuestionId) + 1}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionLogicBuilder;

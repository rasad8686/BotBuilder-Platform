import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Target,
  Plus,
  Trash2,
  Users,
  Globe,
  Calendar,
  Tag,
  Layers
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button, IconButton } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';

const TARGET_TYPES = [
  { value: 'url', label: 'URL', icon: Globe, description: 'Match specific pages' },
  { value: 'user_property', label: 'User Property', icon: Users, description: 'Target specific user attributes' },
  { value: 'user_segment', label: 'User Segment', icon: Layers, description: 'Target predefined segments' },
  { value: 'first_visit', label: 'First Visit', icon: Calendar, description: 'Show only on first visit' },
  { value: 'custom', label: 'Custom', icon: Tag, description: 'Custom targeting condition' }
];

const OPERATORS = {
  url: [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'matches_regex', label: 'Matches regex' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'not_contains', label: 'Does not contain' }
  ],
  user_property: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Does not exist' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' }
  ],
  user_segment: [
    { value: 'in', label: 'Is in segment' },
    { value: 'not_in', label: 'Is not in segment' }
  ],
  first_visit: [
    { value: 'is_true', label: 'Is first visit' },
    { value: 'is_false', label: 'Is not first visit' }
  ],
  custom: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'exists', label: 'Exists' }
  ]
};

const USER_SEGMENTS = [
  { value: 'new_users', label: 'New Users (< 7 days)' },
  { value: 'active_users', label: 'Active Users' },
  { value: 'power_users', label: 'Power Users' },
  { value: 'trial_users', label: 'Trial Users' },
  { value: 'paying_customers', label: 'Paying Customers' },
  { value: 'churned_users', label: 'Churned Users' }
];

export default function TourTargetingForm({ targeting, onChange }) {
  const { t } = useTranslation();

  const handleLogicChange = (logic) => {
    onChange({
      ...targeting,
      logic
    });
  };

  const handleAddRule = () => {
    const newRule = {
      id: `rule-${Date.now()}`,
      type: 'url',
      operator: 'contains',
      value: ''
    };

    onChange({
      ...targeting,
      rules: [...(targeting?.rules || []), newRule]
    });
  };

  const handleUpdateRule = (index, updates) => {
    const newRules = targeting.rules.map((rule, i) =>
      i === index ? { ...rule, ...updates } : rule
    );
    onChange({
      ...targeting,
      rules: newRules
    });
  };

  const handleDeleteRule = (index) => {
    const newRules = targeting.rules.filter((_, i) => i !== index);
    onChange({
      ...targeting,
      rules: newRules
    });
  };

  const rules = targeting?.rules || [];

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card variant="info">
        <CardContent>
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                {t('tours.targetingInfo', 'Targeting Rules')}
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {t('tours.targetingInfoDesc', 'Define conditions to control who sees this tour and when. Leave empty to show to all users.')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logic Selector */}
      {rules.length > 1 && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('tours.matchLogic', 'Match')}:
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLogicChange('AND')}
                  className={`
                    px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    ${targeting?.logic === 'AND' || !targeting?.logic
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300'
                    }
                  `}
                >
                  {t('tours.allRules', 'ALL rules')} (AND)
                </button>
                <button
                  onClick={() => handleLogicChange('OR')}
                  className={`
                    px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    ${targeting?.logic === 'OR'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300'
                    }
                  `}
                >
                  {t('tours.anyRule', 'ANY rule')} (OR)
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      <Card>
        <CardHeader
          actions={
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleAddRule}
            >
              {t('tours.addRule', 'Add Rule')}
            </Button>
          }
        >
          <CardTitle size="md">{t('tours.rules', 'Rules')}</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                <Target className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                {t('tours.noRules', 'No targeting rules')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('tours.noRulesDesc', 'This tour will be shown to all users. Add rules to target specific audiences.')}
              </p>
              <Button variant="outline" icon={Plus} onClick={handleAddRule}>
                {t('tours.addFirstRule', 'Add First Rule')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule, index) => (
                <RuleEditor
                  key={rule.id || index}
                  rule={rule}
                  index={index}
                  showLogic={index > 0}
                  logic={targeting?.logic || 'AND'}
                  onChange={(updates) => handleUpdateRule(index, updates)}
                  onDelete={() => handleDeleteRule(index)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Targets */}
      <Card>
        <CardHeader>
          <CardTitle size="md">{t('tours.quickTargets', 'Quick Targets')}</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('tours.quickTargetsDesc', 'Click to add common targeting rules')}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <QuickTargetButton
              label={t('tours.newUsers', 'New Users')}
              onClick={() => {
                onChange({
                  ...targeting,
                  rules: [...rules, {
                    id: `rule-${Date.now()}`,
                    type: 'user_segment',
                    operator: 'in',
                    value: 'new_users'
                  }]
                });
              }}
            />
            <QuickTargetButton
              label={t('tours.firstVisit', 'First Visit Only')}
              onClick={() => {
                onChange({
                  ...targeting,
                  rules: [...rules, {
                    id: `rule-${Date.now()}`,
                    type: 'first_visit',
                    operator: 'is_true',
                    value: 'true'
                  }]
                });
              }}
            />
            <QuickTargetButton
              label={t('tours.dashboardPage', 'Dashboard Page')}
              onClick={() => {
                onChange({
                  ...targeting,
                  rules: [...rules, {
                    id: `rule-${Date.now()}`,
                    type: 'url',
                    operator: 'contains',
                    value: '/dashboard'
                  }]
                });
              }}
            />
            <QuickTargetButton
              label={t('tours.trialUsers', 'Trial Users')}
              onClick={() => {
                onChange({
                  ...targeting,
                  rules: [...rules, {
                    id: `rule-${Date.now()}`,
                    type: 'user_segment',
                    operator: 'in',
                    value: 'trial_users'
                  }]
                });
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RuleEditor({ rule, index, showLogic, logic, onChange, onDelete }) {
  const { t } = useTranslation();
  const targetType = TARGET_TYPES.find(t => t.value === rule.type) || TARGET_TYPES[0];
  const operators = OPERATORS[rule.type] || OPERATORS.url;
  const Icon = targetType.icon;

  return (
    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
      {showLogic && (
        <div className="mb-3">
          <Badge variant="outline" size="sm">
            {logic}
          </Badge>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900/30`}>
          <Icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>

        <div className="flex-1 grid grid-cols-3 gap-3">
          {/* Type Selector */}
          <Select
            value={rule.type}
            onChange={(e) => onChange({ type: e.target.value, operator: OPERATORS[e.target.value][0].value })}
            options={TARGET_TYPES.map(t => ({ value: t.value, label: t.label }))}
          />

          {/* Operator Selector */}
          <Select
            value={rule.operator}
            onChange={(e) => onChange({ operator: e.target.value })}
            options={operators}
          />

          {/* Value Input */}
          {rule.type === 'user_segment' ? (
            <Select
              value={rule.value}
              onChange={(e) => onChange({ value: e.target.value })}
              options={USER_SEGMENTS}
              placeholder={t('tours.selectSegment', 'Select segment')}
            />
          ) : rule.type === 'first_visit' ? (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              {rule.operator === 'is_true' ? t('tours.onFirstVisit', 'On first visit') : t('tours.notFirstVisit', 'Not first visit')}
            </div>
          ) : (
            <Input
              value={rule.value || ''}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={
                rule.type === 'url' ? '/dashboard/*' :
                rule.type === 'user_property' ? 'plan=premium' :
                'value'
              }
            />
          )}
        </div>

        <IconButton
          icon={Trash2}
          variant="ghost"
          onClick={onDelete}
          label={t('common.delete', 'Delete')}
          className="text-gray-400 hover:text-red-600"
        />
      </div>

      {rule.type === 'user_property' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-13">
          {t('tours.userPropertyHelp', 'Use format: property_name=value or just property_name')}
        </p>
      )}
    </div>
  );
}

function QuickTargetButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm font-medium rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
    >
      + {label}
    </button>
  );
}

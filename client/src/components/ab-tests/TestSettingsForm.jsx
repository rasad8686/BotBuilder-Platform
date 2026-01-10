import { useTranslation } from 'react-i18next';
import {
  Settings,
  Target,
  Calendar,
  Zap,
  Award
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Input, Textarea, Select } from '../ui/Input';

export default function TestSettingsForm({
  name,
  description,
  testType,
  goalMetric,
  settings,
  onChange,
  disabled
}) {
  const { t } = useTranslation();

  const testTypeOptions = [
    { value: 'message', label: t('abTests.typeMessage', 'Message') },
    { value: 'button', label: t('abTests.typeButton', 'Button') },
    { value: 'widget', label: t('abTests.typeWidget', 'Widget') },
    { value: 'welcome', label: t('abTests.typeWelcome', 'Welcome Message') },
    { value: 'flow', label: t('abTests.typeFlow', 'Conversation Flow') },
    { value: 'tour', label: t('abTests.typeTour', 'Product Tour') }
  ];

  const goalMetricOptions = [
    { value: 'conversion', label: t('abTests.goalConversion', 'Conversion Rate') },
    { value: 'engagement', label: t('abTests.goalEngagement', 'Engagement Rate') },
    { value: 'clicks', label: t('abTests.goalClicks', 'Click-through Rate') },
    { value: 'completion', label: t('abTests.goalCompletion', 'Completion Rate') },
    { value: 'revenue', label: t('abTests.goalRevenue', 'Revenue') },
    { value: 'time_on_page', label: t('abTests.goalTimeOnPage', 'Time on Page') }
  ];

  const handleSettingsChange = (key, value) => {
    onChange({
      settings: {
        ...settings,
        [key]: value
      }
    });
  };

  const handleAutoWinnerChange = (key, value) => {
    onChange({
      settings: {
        ...settings,
        auto_winner: {
          ...settings.auto_winner,
          [key]: value
        }
      }
    });
  };

  const handleScheduleChange = (key, value) => {
    onChange({
      settings: {
        ...settings,
        schedule: {
          ...settings.schedule,
          [key]: value
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            {t('abTests.basicInfo', 'Basic Information')}
          </CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('abTests.testName', 'Test Name')} *
            </label>
            <Input
              value={name || ''}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={t('abTests.enterTestName', 'e.g., Homepage CTA Button Test')}
              disabled={disabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('abTests.description', 'Description')}
            </label>
            <Textarea
              value={description || ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder={t('abTests.enterDescription', 'Describe what you are testing and why...')}
              rows={3}
              disabled={disabled}
            />
          </div>
        </div>
      </Card>

      {/* Test Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            {t('abTests.testType', 'Test Type')}
          </CardTitle>
        </CardHeader>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {testTypeOptions.map(option => (
              <button
                key={option.value}
                onClick={() => !disabled && onChange({ test_type: option.value })}
                disabled={disabled}
                className={`
                  p-4 rounded-lg border-2 text-left transition-all
                  ${testType === option.value
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span className={`text-sm font-medium ${testType === option.value ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Goal Metric */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            {t('abTests.goalMetric', 'Goal Metric')}
          </CardTitle>
        </CardHeader>
        <div className="p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('abTests.goalMetricDescription', 'Select the primary metric to measure the success of this test')}
          </p>
          <Select
            value={goalMetric}
            onChange={(e) => onChange({ goal_metric: e.target.value })}
            options={goalMetricOptions}
            disabled={disabled}
          />
        </div>
      </Card>

      {/* Auto Winner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            {t('abTests.autoWinner', 'Automatic Winner Selection')}
          </CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t('abTests.enableAutoWinner', 'Enable Automatic Winner')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('abTests.autoWinnerDescription', 'Automatically declare a winner when statistical significance is reached')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_winner?.enabled}
                onChange={(e) => handleAutoWinnerChange('enabled', e.target.checked)}
                disabled={disabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
            </label>
          </div>

          {settings.auto_winner?.enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.confidenceThreshold', 'Confidence Threshold')}
              </label>
              <Select
                value={settings.auto_winner?.confidence_threshold?.toString() || '95'}
                onChange={(e) => handleAutoWinnerChange('confidence_threshold', parseInt(e.target.value))}
                options={[
                  { value: '90', label: '90%' },
                  { value: '95', label: '95% (Recommended)' },
                  { value: '99', label: '99%' }
                ]}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            {t('abTests.schedule', 'Schedule')}
          </CardTitle>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.startDate', 'Start Date')}
              </label>
              <Input
                type="datetime-local"
                value={settings.schedule?.start_date || ''}
                onChange={(e) => handleScheduleChange('start_date', e.target.value)}
                disabled={disabled}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('abTests.startDateHint', 'Leave empty to start immediately')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.endDate', 'End Date')}
              </label>
              <Input
                type="datetime-local"
                value={settings.schedule?.end_date || ''}
                onChange={(e) => handleScheduleChange('end_date', e.target.value)}
                disabled={disabled}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('abTests.endDateHint', 'Leave empty for no end date')}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

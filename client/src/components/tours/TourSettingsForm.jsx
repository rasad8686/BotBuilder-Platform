import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Palette,
  Zap,
  Clock,
  MousePointer,
  Calendar
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Input, Textarea, Select, Switch, Checkbox } from '../ui/Input';
import { Badge } from '../ui/Badge';

const TRIGGER_TYPES = [
  { value: 'manual', label: 'Manual', description: 'Start via API or button click' },
  { value: 'auto', label: 'Auto', description: 'Start automatically on page load' },
  { value: 'delay', label: 'Delay', description: 'Start after a specified delay' },
  { value: 'event', label: 'Event', description: 'Start on custom event' }
];

export default function TourSettingsForm({
  name,
  description,
  settings,
  trigger,
  onChange
}) {
  const { t } = useTranslation();

  const handleChange = (field, value) => {
    onChange({ [field]: value });
  };

  const handleSettingsChange = (field, value) => {
    onChange({
      settings: {
        ...settings,
        [field]: value
      }
    });
  };

  const handleThemeChange = (field, value) => {
    onChange({
      settings: {
        ...settings,
        theme: {
          ...settings?.theme,
          [field]: value
        }
      }
    });
  };

  const handleTriggerChange = (field, value) => {
    onChange({
      trigger: {
        ...trigger,
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle size="md" className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            {t('tours.basicInfo', 'Basic Information')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t('tours.tourName', 'Tour Name')}
            placeholder={t('tours.tourNamePlaceholder', 'e.g., Welcome Tour')}
            value={name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />

          <Textarea
            label={t('tours.tourDescription', 'Description')}
            placeholder={t('tours.tourDescPlaceholder', 'Describe what this tour is about...')}
            value={description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Behavior Settings */}
      <Card>
        <CardHeader>
          <CardTitle size="md" className="flex items-center gap-2">
            <MousePointer className="w-5 h-5 text-purple-600" />
            {t('tours.behaviorSettings', 'Behavior')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Switch
            label={t('tours.dismissible', 'Dismissible')}
            description={t('tours.dismissibleDesc', 'Allow users to close the tour at any time')}
            checked={settings?.dismissible ?? true}
            onChange={(checked) => handleSettingsChange('dismissible', checked)}
          />

          <Switch
            label={t('tours.showProgressBar', 'Show Progress Bar')}
            description={t('tours.progressBarDesc', 'Display progress indicator at the top')}
            checked={settings?.showProgressBar ?? true}
            onChange={(checked) => handleSettingsChange('showProgressBar', checked)}
          />

          <Switch
            label={t('tours.showStepNumbers', 'Show Step Numbers')}
            description={t('tours.stepNumbersDesc', 'Display step counter (e.g., 1 of 5)')}
            checked={settings?.showStepNumbers ?? true}
            onChange={(checked) => handleSettingsChange('showStepNumbers', checked)}
          />

          <Switch
            label={t('tours.allowSkip', 'Allow Skip')}
            description={t('tours.allowSkipDesc', 'Let users skip individual steps')}
            checked={settings?.allowSkip ?? true}
            onChange={(checked) => handleSettingsChange('allowSkip', checked)}
          />

          <Switch
            label={t('tours.keyboardNav', 'Keyboard Navigation')}
            description={t('tours.keyboardNavDesc', 'Enable arrow keys and Escape for navigation')}
            checked={settings?.keyboardNav ?? true}
            onChange={(checked) => handleSettingsChange('keyboardNav', checked)}
          />

          <Switch
            label={t('tours.closeOnOverlay', 'Close on Overlay Click')}
            description={t('tours.closeOnOverlayDesc', 'Close tour when clicking outside the step')}
            checked={settings?.closeOnOverlay ?? false}
            onChange={(checked) => handleSettingsChange('closeOnOverlay', checked)}
          />
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle size="md" className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-600" />
            {t('tours.themeSettings', 'Theme')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tours.primaryColor', 'Primary Color')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings?.theme?.primaryColor || '#7c3aed'}
                  onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 dark:border-slate-600 cursor-pointer"
                />
                <Input
                  value={settings?.theme?.primaryColor || '#7c3aed'}
                  onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                  placeholder="#7c3aed"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tours.backgroundColor', 'Background Color')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings?.theme?.backgroundColor || '#ffffff'}
                  onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 dark:border-slate-600 cursor-pointer"
                />
                <Input
                  value={settings?.theme?.backgroundColor || '#ffffff'}
                  onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tours.textColor', 'Text Color')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings?.theme?.textColor || '#1f2937'}
                  onChange={(e) => handleThemeChange('textColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 dark:border-slate-600 cursor-pointer"
                />
                <Input
                  value={settings?.theme?.textColor || '#1f2937'}
                  onChange={(e) => handleThemeChange('textColor', e.target.value)}
                  placeholder="#1f2937"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tours.borderRadius', 'Border Radius')}
              </label>
              <Select
                value={settings?.theme?.borderRadius || '8px'}
                onChange={(e) => handleThemeChange('borderRadius', e.target.value)}
                options={[
                  { value: '0px', label: 'None (0px)' },
                  { value: '4px', label: 'Small (4px)' },
                  { value: '8px', label: 'Medium (8px)' },
                  { value: '12px', label: 'Large (12px)' },
                  { value: '16px', label: 'Extra Large (16px)' }
                ]}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="mt-6 p-4 bg-gray-100 dark:bg-slate-800 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {t('tours.themePreview', 'Preview')}
            </p>
            <div
              className="p-4 rounded shadow-lg"
              style={{
                backgroundColor: settings?.theme?.backgroundColor || '#ffffff',
                color: settings?.theme?.textColor || '#1f2937',
                borderRadius: settings?.theme?.borderRadius || '8px'
              }}
            >
              <h4 className="font-semibold mb-2">Welcome to Our App!</h4>
              <p className="text-sm opacity-75 mb-3">This is how your tour steps will look.</p>
              <button
                className="px-4 py-2 text-white text-sm font-medium rounded"
                style={{
                  backgroundColor: settings?.theme?.primaryColor || '#7c3aed',
                  borderRadius: settings?.theme?.borderRadius || '8px'
                }}
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trigger Settings */}
      <Card>
        <CardHeader>
          <CardTitle size="md" className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            {t('tours.triggerSettings', 'Trigger')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('tours.triggerType', 'When should this tour start?')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TRIGGER_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleTriggerChange('type', type.value)}
                  className={`
                    p-4 rounded-lg border-2 text-left transition-all
                    ${trigger?.type === type.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                    }
                  `}
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {type.label}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Delay config */}
          {trigger?.type === 'delay' && (
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <Input
                type="number"
                label={t('tours.delaySeconds', 'Delay (seconds)')}
                value={trigger?.delay || 0}
                onChange={(e) => handleTriggerChange('delay', parseInt(e.target.value) || 0)}
                min={0}
                max={60}
                className="w-32"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('tours.secondsAfterLoad', 'seconds after page load')}
              </span>
            </div>
          )}

          {/* Event config */}
          {trigger?.type === 'event' && (
            <Input
              label={t('tours.eventName', 'Event Name')}
              placeholder="user_signed_up"
              value={trigger?.eventName || ''}
              onChange={(e) => handleTriggerChange('eventName', e.target.value)}
              helperText={t('tours.eventNameHelp', 'Custom event that will trigger this tour')}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

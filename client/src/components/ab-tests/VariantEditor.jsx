import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trash2,
  GripVertical,
  Type,
  Image,
  Link2,
  MessageSquare,
  MousePointer,
  Palette
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';

export default function VariantEditor({
  variant,
  testType,
  onChange,
  onDelete,
  canDelete,
  disabled
}) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('content');

  const handleContentChange = (key, value) => {
    onChange({
      content: {
        ...variant.content,
        [key]: value
      }
    });
  };

  const sections = [
    { id: 'content', label: t('abTests.content', 'Content'), icon: Type },
    { id: 'style', label: t('abTests.style', 'Style'), icon: Palette },
    { id: 'action', label: t('abTests.action', 'Action'), icon: MousePointer }
  ];

  // Render content editor based on test type
  const renderContentEditor = () => {
    switch (testType) {
      case 'message':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.messageText', 'Message Text')}
              </label>
              <Textarea
                value={variant.content?.text || ''}
                onChange={(e) => handleContentChange('text', e.target.value)}
                placeholder={t('abTests.enterMessage', 'Enter your message...')}
                rows={4}
                disabled={disabled}
              />
            </div>
          </div>
        );

      case 'button':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.buttonText', 'Button Text')}
              </label>
              <Input
                value={variant.content?.buttonText || ''}
                onChange={(e) => handleContentChange('buttonText', e.target.value)}
                placeholder={t('abTests.enterButtonText', 'e.g., Get Started')}
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.buttonUrl', 'Button URL')}
              </label>
              <Input
                value={variant.content?.buttonUrl || ''}
                onChange={(e) => handleContentChange('buttonUrl', e.target.value)}
                placeholder="https://..."
                leftIcon={Link2}
                disabled={disabled}
              />
            </div>
          </div>
        );

      case 'widget':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.widgetTitle', 'Widget Title')}
              </label>
              <Input
                value={variant.content?.title || ''}
                onChange={(e) => handleContentChange('title', e.target.value)}
                placeholder={t('abTests.enterTitle', 'Enter title...')}
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.widgetSubtitle', 'Widget Subtitle')}
              </label>
              <Input
                value={variant.content?.subtitle || ''}
                onChange={(e) => handleContentChange('subtitle', e.target.value)}
                placeholder={t('abTests.enterSubtitle', 'Enter subtitle...')}
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.widgetPosition', 'Position')}
              </label>
              <Select
                value={variant.content?.position || 'bottom-right'}
                onChange={(e) => handleContentChange('position', e.target.value)}
                options={[
                  { value: 'bottom-right', label: 'Bottom Right' },
                  { value: 'bottom-left', label: 'Bottom Left' },
                  { value: 'top-right', label: 'Top Right' },
                  { value: 'top-left', label: 'Top Left' }
                ]}
                disabled={disabled}
              />
            </div>
          </div>
        );

      case 'welcome':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.welcomeHeading', 'Heading')}
              </label>
              <Input
                value={variant.content?.heading || ''}
                onChange={(e) => handleContentChange('heading', e.target.value)}
                placeholder={t('abTests.enterHeading', 'e.g., Welcome!')}
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.welcomeMessage', 'Welcome Message')}
              </label>
              <Textarea
                value={variant.content?.message || ''}
                onChange={(e) => handleContentChange('message', e.target.value)}
                placeholder={t('abTests.enterWelcomeMessage', 'Enter your welcome message...')}
                rows={3}
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.ctaText', 'CTA Button Text')}
              </label>
              <Input
                value={variant.content?.ctaText || ''}
                onChange={(e) => handleContentChange('ctaText', e.target.value)}
                placeholder={t('abTests.enterCtaText', 'e.g., Get Started')}
                disabled={disabled}
              />
            </div>
          </div>
        );

      case 'flow':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.flowId', 'Flow ID')}
              </label>
              <Input
                value={variant.content?.flowId || ''}
                onChange={(e) => handleContentChange('flowId', e.target.value)}
                placeholder={t('abTests.selectFlow', 'Select or enter flow ID')}
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.flowTrigger', 'Trigger Type')}
              </label>
              <Select
                value={variant.content?.trigger || 'auto'}
                onChange={(e) => handleContentChange('trigger', e.target.value)}
                options={[
                  { value: 'auto', label: 'Auto Start' },
                  { value: 'click', label: 'On Click' },
                  { value: 'scroll', label: 'On Scroll' },
                  { value: 'delay', label: 'After Delay' }
                ]}
                disabled={disabled}
              />
            </div>
          </div>
        );

      case 'tour':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('abTests.tourId', 'Tour ID')}
              </label>
              <Input
                value={variant.content?.tourId || ''}
                onChange={(e) => handleContentChange('tourId', e.target.value)}
                placeholder={t('abTests.selectTour', 'Select or enter tour ID')}
                disabled={disabled}
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('abTests.selectTestType', 'Select a test type in Settings to configure content')}
          </div>
        );
    }
  };

  const renderStyleEditor = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('abTests.primaryColor', 'Primary Color')}
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={variant.content?.primaryColor || '#7c3aed'}
              onChange={(e) => handleContentChange('primaryColor', e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
              disabled={disabled}
            />
            <Input
              value={variant.content?.primaryColor || '#7c3aed'}
              onChange={(e) => handleContentChange('primaryColor', e.target.value)}
              className="flex-1"
              disabled={disabled}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('abTests.backgroundColor', 'Background Color')}
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={variant.content?.backgroundColor || '#ffffff'}
              onChange={(e) => handleContentChange('backgroundColor', e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
              disabled={disabled}
            />
            <Input
              value={variant.content?.backgroundColor || '#ffffff'}
              onChange={(e) => handleContentChange('backgroundColor', e.target.value)}
              className="flex-1"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('abTests.fontSize', 'Font Size')}
        </label>
        <Select
          value={variant.content?.fontSize || 'medium'}
          onChange={(e) => handleContentChange('fontSize', e.target.value)}
          options={[
            { value: 'small', label: 'Small (14px)' },
            { value: 'medium', label: 'Medium (16px)' },
            { value: 'large', label: 'Large (18px)' }
          ]}
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('abTests.borderRadius', 'Border Radius')}
        </label>
        <Select
          value={variant.content?.borderRadius || 'medium'}
          onChange={(e) => handleContentChange('borderRadius', e.target.value)}
          options={[
            { value: 'none', label: 'None (0px)' },
            { value: 'small', label: 'Small (4px)' },
            { value: 'medium', label: 'Medium (8px)' },
            { value: 'large', label: 'Large (12px)' },
            { value: 'full', label: 'Full (9999px)' }
          ]}
          disabled={disabled}
        />
      </div>
    </div>
  );

  const renderActionEditor = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('abTests.clickAction', 'Click Action')}
        </label>
        <Select
          value={variant.content?.clickAction || 'none'}
          onChange={(e) => handleContentChange('clickAction', e.target.value)}
          options={[
            { value: 'none', label: 'No Action' },
            { value: 'link', label: 'Open Link' },
            { value: 'flow', label: 'Start Flow' },
            { value: 'close', label: 'Close Widget' },
            { value: 'custom', label: 'Custom Event' }
          ]}
          disabled={disabled}
        />
      </div>

      {variant.content?.clickAction === 'link' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('abTests.linkUrl', 'Link URL')}
          </label>
          <Input
            value={variant.content?.linkUrl || ''}
            onChange={(e) => handleContentChange('linkUrl', e.target.value)}
            placeholder="https://..."
            leftIcon={Link2}
            disabled={disabled}
          />
        </div>
      )}

      {variant.content?.clickAction === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('abTests.eventName', 'Event Name')}
          </label>
          <Input
            value={variant.content?.eventName || ''}
            onChange={(e) => handleContentChange('eventName', e.target.value)}
            placeholder="e.g., cta_clicked"
            disabled={disabled}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="trackClicks"
          checked={variant.content?.trackClicks !== false}
          onChange={(e) => handleContentChange('trackClicks', e.target.checked)}
          className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
          disabled={disabled}
        />
        <label htmlFor="trackClicks" className="text-sm text-gray-700 dark:text-gray-300">
          {t('abTests.trackClicks', 'Track clicks as conversions')}
        </label>
      </div>
    </div>
  );

  return (
    <div className="p-4">
      {/* Variant Name */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <Input
            value={variant.name || ''}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('abTests.variantName', 'Variant name')}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={variant.is_control}
              onChange={(e) => onChange({ is_control: e.target.checked })}
              className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
              disabled={disabled}
            />
            {t('abTests.isControl', 'Control')}
          </label>

          {canDelete && !disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-slate-700">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeSection === section.id
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }
            `}
          >
            <section.icon className="w-4 h-4" />
            {section.label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      {activeSection === 'content' && renderContentEditor()}
      {activeSection === 'style' && renderStyleEditor()}
      {activeSection === 'action' && renderActionEditor()}
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  X,
  Target,
  Type,
  AlignLeft,
  MousePointer,
  Plus,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button, IconButton } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';
import StepTypeSelector from './StepTypeSelector';

const POSITIONS = [
  { value: 'top', label: 'Top' },
  { value: 'top-start', label: 'Top Start' },
  { value: 'top-end', label: 'Top End' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'bottom-start', label: 'Bottom Start' },
  { value: 'bottom-end', label: 'Bottom End' },
  { value: 'left', label: 'Left' },
  { value: 'left-start', label: 'Left Start' },
  { value: 'left-end', label: 'Left End' },
  { value: 'right', label: 'Right' },
  { value: 'right-start', label: 'Right Start' },
  { value: 'right-end', label: 'Right End' }
];

const ACTION_TYPES = [
  { value: 'next', label: 'Next Step' },
  { value: 'prev', label: 'Previous Step' },
  { value: 'skip', label: 'Skip Tour' },
  { value: 'finish', label: 'Finish Tour' },
  { value: 'link', label: 'Open Link' },
  { value: 'custom', label: 'Custom Event' }
];

export default function TourStepEditor({
  step,
  stepNumber,
  totalSteps,
  onChange,
  onClose
}) {
  const { t } = useTranslation();
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const handleFieldChange = (field, value) => {
    onChange({ [field]: value });
  };

  const handleAddAction = () => {
    const newAction = {
      id: `action-${Date.now()}`,
      type: 'next',
      label: t('tours.next', 'Next')
    };
    onChange({
      actions: [...(step.actions || []), newAction]
    });
  };

  const handleUpdateAction = (index, updates) => {
    const newActions = step.actions.map((action, i) =>
      i === index ? { ...action, ...updates } : action
    );
    onChange({ actions: newActions });
  };

  const handleDeleteAction = (index) => {
    const newActions = step.actions.filter((_, i) => i !== index);
    onChange({ actions: newActions });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <Card>
        <CardHeader
          actions={
            <IconButton
              icon={X}
              variant="ghost"
              onClick={onClose}
              label={t('common.close', 'Close')}
            />
          }
        >
          <div className="flex items-center gap-3">
            <Badge variant="primary">{t('tours.step', 'Step')} {stepNumber}</Badge>
            <CardTitle size="md">{t('tours.editStep', 'Edit Step')}</CardTitle>
          </div>
        </CardHeader>

        <div className="space-y-6">
          {/* Step Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('tours.stepType', 'Step Type')}
            </label>
            <button
              onClick={() => setShowTypeSelector(!showTypeSelector)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-purple-500 transition-colors"
            >
              <span className="font-medium text-gray-900 dark:text-white capitalize">
                {step.type || 'tooltip'}
              </span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showTypeSelector ? 'rotate-180' : ''}`} />
            </button>

            {showTypeSelector && (
              <div className="mt-2">
                <StepTypeSelector
                  selected={step.type}
                  onSelect={(type) => {
                    handleFieldChange('type', type);
                    setShowTypeSelector(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Target Selector */}
          <Input
            label={t('tours.targetSelector', 'Target Selector (CSS)')}
            placeholder="#my-button, .my-class, [data-tour='step1']"
            value={step.target || ''}
            onChange={(e) => handleFieldChange('target', e.target.value)}
            leftIcon={Target}
            helperText={t('tours.targetHelp', 'CSS selector for the element to highlight')}
          />

          {/* Title */}
          <Input
            label={t('tours.stepTitle', 'Title')}
            placeholder={t('tours.stepTitlePlaceholder', 'Welcome to our app!')}
            value={step.title || ''}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            leftIcon={Type}
          />

          {/* Content */}
          <Textarea
            label={t('tours.stepContent', 'Content')}
            placeholder={t('tours.stepContentPlaceholder', 'Describe this step...')}
            value={step.content || ''}
            onChange={(e) => handleFieldChange('content', e.target.value)}
            rows={4}
          />

          {/* Position (for tooltip/hotspot) */}
          {(step.type === 'tooltip' || step.type === 'hotspot' || !step.type) && (
            <Select
              label={t('tours.position', 'Position')}
              value={step.position || 'bottom'}
              onChange={(e) => handleFieldChange('position', e.target.value)}
              options={POSITIONS}
            />
          )}

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('tours.actions', 'Actions / Buttons')}
              </label>
              <Button
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={handleAddAction}
              >
                {t('tours.addAction', 'Add')}
              </Button>
            </div>

            <div className="space-y-3">
              {(step.actions || []).map((action, index) => (
                <ActionEditor
                  key={action.id || index}
                  action={action}
                  isLast={stepNumber === totalSteps}
                  onChange={(updates) => handleUpdateAction(index, updates)}
                  onDelete={() => handleDeleteAction(index)}
                />
              ))}

              {(!step.actions || step.actions.length === 0) && (
                <div className="text-center py-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('tours.noActions', 'No actions yet. Add buttons for navigation.')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Options */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              {t('tours.advancedOptions', 'Advanced Options')}
            </summary>

            <div className="mt-4 space-y-4 pl-6">
              {/* Highlight Style */}
              <Select
                label={t('tours.highlightStyle', 'Highlight Style')}
                value={step.highlightStyle || 'overlay'}
                onChange={(e) => handleFieldChange('highlightStyle', e.target.value)}
                options={[
                  { value: 'overlay', label: 'Overlay (dim background)' },
                  { value: 'border', label: 'Border only' },
                  { value: 'none', label: 'No highlight' }
                ]}
              />

              {/* Wait for Element */}
              <Input
                label={t('tours.waitForElement', 'Wait for Element')}
                placeholder=".loading-complete"
                value={step.waitFor || ''}
                onChange={(e) => handleFieldChange('waitFor', e.target.value)}
                helperText={t('tours.waitForHelp', 'Wait until this element appears before showing step')}
              />

              {/* Custom CSS Class */}
              <Input
                label={t('tours.customClass', 'Custom CSS Class')}
                placeholder="my-custom-step"
                value={step.customClass || ''}
                onChange={(e) => handleFieldChange('customClass', e.target.value)}
              />
            </div>
          </details>
        </div>
      </Card>
    </motion.div>
  );
}

function ActionEditor({ action, isLast, onChange, onDelete }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
      <div className="flex-1 grid grid-cols-2 gap-3">
        <Input
          placeholder={t('tours.buttonLabel', 'Button Label')}
          value={action.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          size="sm"
        />
        <Select
          value={action.type || 'next'}
          onChange={(e) => onChange({ type: e.target.value })}
          options={ACTION_TYPES}
          size="sm"
        />

        {action.type === 'link' && (
          <Input
            placeholder="https://..."
            value={action.url || ''}
            onChange={(e) => onChange({ url: e.target.value })}
            size="sm"
            className="col-span-2"
          />
        )}

        {action.type === 'custom' && (
          <Input
            placeholder={t('tours.eventName', 'Event name')}
            value={action.eventName || ''}
            onChange={(e) => onChange({ eventName: e.target.value })}
            size="sm"
            className="col-span-2"
          />
        )}
      </div>

      <IconButton
        icon={Trash2}
        variant="ghost"
        size="sm"
        onClick={onDelete}
        label={t('common.delete', 'Delete')}
        className="text-gray-400 hover:text-red-600"
      />
    </div>
  );
}

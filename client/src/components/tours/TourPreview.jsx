import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Smartphone,
  Tablet,
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  RotateCcw
} from 'lucide-react';
import { Button, IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';

const DEVICE_SIZES = {
  desktop: { width: '100%', height: '100%', label: 'Desktop' },
  tablet: { width: '768px', height: '1024px', label: 'Tablet' },
  mobile: { width: '375px', height: '667px', label: 'Mobile' }
};

export default function TourPreview({
  steps,
  settings,
  currentStepIndex,
  onStepChange
}) {
  const { t } = useTranslation();
  const [device, setDevice] = useState('desktop');
  const [isPlaying, setIsPlaying] = useState(false);

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const theme = settings?.theme || {};

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      onStepChange(currentStepIndex - 1);
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      onStepChange(currentStepIndex + 1);
    }
  };

  const handleRestart = () => {
    onStepChange(0);
  };

  if (totalSteps === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-4">
          <Monitor className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
          {t('tours.noStepsPreview', 'No steps to preview')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('tours.addStepsToPreview', 'Add steps to see the preview')}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Preview Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {t('tours.preview', 'Preview')}
          </h3>

          {/* Device Switcher */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
            <DeviceButton
              icon={Monitor}
              device="desktop"
              current={device}
              onClick={() => setDevice('desktop')}
            />
            <DeviceButton
              icon={Tablet}
              device="tablet"
              current={device}
              onClick={() => setDevice('tablet')}
            />
            <DeviceButton
              icon={Smartphone}
              device="mobile"
              current={device}
              onClick={() => setDevice('mobile')}
            />
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconButton
              icon={ChevronLeft}
              variant="secondary"
              size="sm"
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              label="Previous step"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px] text-center">
              {currentStepIndex + 1} / {totalSteps}
            </span>
            <IconButton
              icon={ChevronRight}
              variant="secondary"
              size="sm"
              onClick={handleNextStep}
              disabled={currentStepIndex === totalSteps - 1}
              label="Next step"
            />
          </div>

          <IconButton
            icon={RotateCcw}
            variant="ghost"
            size="sm"
            onClick={handleRestart}
            label="Restart preview"
          />
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 p-4 overflow-hidden bg-gray-50 dark:bg-slate-900">
        <div
          className="h-full mx-auto bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden relative transition-all duration-300"
          style={{
            maxWidth: DEVICE_SIZES[device].width,
            maxHeight: DEVICE_SIZES[device].height
          }}
        >
          {/* Mock Browser UI */}
          <div className="h-8 bg-gray-100 dark:bg-slate-700 flex items-center px-3 gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-4">
              <div className="h-5 bg-white dark:bg-slate-600 rounded text-xs flex items-center px-2 text-gray-400">
                yourapp.com/dashboard
              </div>
            </div>
          </div>

          {/* Mock Page Content */}
          <div className="relative h-[calc(100%-2rem)] bg-gray-50 dark:bg-slate-800 p-4">
            {/* Mock Elements */}
            <MockPageContent />

            {/* Tour Step Overlay */}
            <AnimatePresence mode="wait">
              {currentStep && (
                <TourStepPreview
                  key={currentStepIndex}
                  step={currentStep}
                  stepNumber={currentStepIndex + 1}
                  totalSteps={totalSteps}
                  theme={theme}
                  settings={settings}
                  onNext={handleNextStep}
                  onPrev={handlePrevStep}
                  onClose={() => {}}
                  isLast={currentStepIndex === totalSteps - 1}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceButton({ icon: Icon, device, current, onClick }) {
  const isActive = device === current;

  return (
    <button
      onClick={onClick}
      className={`
        p-2 rounded-lg transition-colors
        ${isActive
          ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }
      `}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function MockPageContent() {
  return (
    <div className="space-y-4">
      {/* Mock Header */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-8 w-8 bg-purple-200 dark:bg-purple-900/30 rounded-full" />
        </div>
      </div>

      {/* Mock Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
            <div className="h-4 w-16 bg-gray-200 dark:bg-slate-600 rounded mb-2" />
            <div className="h-8 w-12 bg-gray-300 dark:bg-slate-500 rounded" />
          </div>
        ))}
      </div>

      {/* Mock Table */}
      <div className="bg-white dark:bg-slate-700 rounded-lg shadow-sm p-3">
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-slate-600 last:border-0">
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-600 rounded-full" />
              <div className="flex-1">
                <div className="h-3 w-24 bg-gray-200 dark:bg-slate-600 rounded" />
              </div>
              <div className="h-3 w-16 bg-gray-200 dark:bg-slate-600 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TourStepPreview({
  step,
  stepNumber,
  totalSteps,
  theme,
  settings,
  onNext,
  onPrev,
  onClose,
  isLast
}) {
  const { t } = useTranslation();

  const stepStyle = {
    backgroundColor: theme.backgroundColor || '#ffffff',
    color: theme.textColor || '#1f2937',
    borderRadius: theme.borderRadius || '8px'
  };

  const buttonStyle = {
    backgroundColor: theme.primaryColor || '#7c3aed',
    borderRadius: theme.borderRadius || '8px'
  };

  // Different render based on step type
  if (step.type === 'modal') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm p-6 shadow-2xl"
          style={stepStyle}
        >
          {settings?.dismissible && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {settings?.showStepNumbers && (
            <div className="text-sm text-gray-500 mb-2">
              {stepNumber} of {totalSteps}
            </div>
          )}

          <h3 className="text-lg font-semibold mb-2">
            {step.title || 'Step Title'}
          </h3>
          <p className="text-sm opacity-75 mb-4">
            {step.content || 'Step content goes here...'}
          </p>

          {settings?.showProgressBar && (
            <div className="w-full h-1 bg-gray-200 rounded-full mb-4">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(stepNumber / totalSteps) * 100}%`,
                  backgroundColor: theme.primaryColor || '#7c3aed'
                }}
              />
            </div>
          )}

          <div className="flex justify-between">
            {stepNumber > 1 && (
              <button
                onClick={onPrev}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                {t('tours.back', 'Back')}
              </button>
            )}
            <button
              onClick={onNext}
              className="px-4 py-2 text-sm font-medium text-white ml-auto"
              style={buttonStyle}
            >
              {isLast ? t('tours.finish', 'Finish') : t('tours.next', 'Next')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Default: Tooltip
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/30"
    >
      {/* Tooltip positioned at bottom center for demo */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 10, opacity: 0 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-72 p-4 shadow-xl"
        style={stepStyle}
      >
        {/* Arrow */}
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
          style={{ backgroundColor: theme.backgroundColor || '#ffffff' }}
        />

        {settings?.dismissible && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {settings?.showStepNumbers && (
          <div className="text-xs text-gray-500 mb-1">
            {stepNumber} of {totalSteps}
          </div>
        )}

        <h4 className="font-semibold mb-1">
          {step.title || 'Step Title'}
        </h4>
        <p className="text-sm opacity-75 mb-3">
          {step.content || 'Step content goes here...'}
        </p>

        {settings?.showProgressBar && (
          <div className="w-full h-1 bg-gray-200 rounded-full mb-3">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(stepNumber / totalSteps) * 100}%`,
                backgroundColor: theme.primaryColor || '#7c3aed'
              }}
            />
          </div>
        )}

        <div className="flex justify-between items-center">
          {stepNumber > 1 ? (
            <button
              onClick={onPrev}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t('tours.back', 'Back')}
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={onNext}
            className="px-3 py-1.5 text-sm font-medium text-white"
            style={buttonStyle}
          >
            {isLast ? t('tours.finish', 'Finish') : t('tours.next', 'Next')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

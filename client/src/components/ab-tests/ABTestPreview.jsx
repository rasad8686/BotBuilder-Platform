import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Monitor,
  Tablet,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MousePointer,
  Layout,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/Button';

const DEVICE_SIZES = {
  desktop: { width: '100%', height: '100%' },
  tablet: { width: '768px', height: '100%' },
  mobile: { width: '375px', height: '100%' }
};

export default function ABTestPreview({
  testType,
  variants,
  selectedVariantIndex,
  onVariantChange
}) {
  const { t } = useTranslation();
  const [device, setDevice] = useState('desktop');

  const selectedVariant = variants[selectedVariantIndex];

  const renderPreviewContent = () => {
    if (!selectedVariant) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          {t('abTests.selectVariant', 'Select a variant to preview')}
        </div>
      );
    }

    const content = selectedVariant.content || {};

    switch (testType) {
      case 'message':
        return (
          <div className="flex items-end justify-end p-4 h-full">
            <div
              className="max-w-[80%] rounded-2xl rounded-br-md p-4 shadow-lg"
              style={{
                backgroundColor: content.primaryColor || '#7c3aed',
                borderRadius: content.borderRadius === 'none' ? '0' :
                  content.borderRadius === 'small' ? '4px' :
                  content.borderRadius === 'large' ? '12px' :
                  content.borderRadius === 'full' ? '16px' : '8px'
              }}
            >
              <p className="text-white" style={{
                fontSize: content.fontSize === 'small' ? '14px' :
                  content.fontSize === 'large' ? '18px' : '16px'
              }}>
                {content.text || t('abTests.previewMessagePlaceholder', 'Your message will appear here...')}
              </p>
            </div>
          </div>
        );

      case 'button':
        return (
          <div className="flex items-center justify-center h-full">
            <button
              className="px-6 py-3 font-medium text-white shadow-lg transition-transform hover:scale-105"
              style={{
                backgroundColor: content.primaryColor || '#7c3aed',
                borderRadius: content.borderRadius === 'none' ? '0' :
                  content.borderRadius === 'small' ? '4px' :
                  content.borderRadius === 'large' ? '12px' :
                  content.borderRadius === 'full' ? '9999px' : '8px',
                fontSize: content.fontSize === 'small' ? '14px' :
                  content.fontSize === 'large' ? '18px' : '16px'
              }}
            >
              {content.buttonText || t('abTests.previewButtonPlaceholder', 'Click Me')}
            </button>
          </div>
        );

      case 'widget':
        const positions = {
          'bottom-right': 'bottom-4 right-4',
          'bottom-left': 'bottom-4 left-4',
          'top-right': 'top-4 right-4',
          'top-left': 'top-4 left-4'
        };
        return (
          <div className="relative h-full">
            <div className={`absolute ${positions[content.position] || positions['bottom-right']} w-80 rounded-lg shadow-xl overflow-hidden`}
              style={{ backgroundColor: content.backgroundColor || '#ffffff' }}
            >
              <div className="p-4 text-white" style={{ backgroundColor: content.primaryColor || '#7c3aed' }}>
                <h4 className="font-semibold">
                  {content.title || t('abTests.previewWidgetTitle', 'Chat with us')}
                </h4>
                <p className="text-sm opacity-90">
                  {content.subtitle || t('abTests.previewWidgetSubtitle', 'We are here to help!')}
                </p>
              </div>
              <div className="p-4 h-48 bg-gray-50 dark:bg-slate-900">
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  {t('abTests.widgetPreviewArea', 'Chat area preview')}
                </div>
              </div>
            </div>
          </div>
        );

      case 'welcome':
        return (
          <div className="flex items-center justify-center h-full p-4">
            <div className="w-full max-w-md rounded-lg shadow-xl overflow-hidden"
              style={{ backgroundColor: content.backgroundColor || '#ffffff' }}
            >
              <div className="p-6 text-center" style={{ backgroundColor: content.primaryColor || '#7c3aed' }}>
                <Sparkles className="w-12 h-12 text-white mx-auto mb-3" />
                <h2 className="text-xl font-bold text-white">
                  {content.heading || t('abTests.previewWelcomeHeading', 'Welcome!')}
                </h2>
              </div>
              <div className="p-6">
                <p className="text-gray-700 dark:text-gray-300 text-center mb-4">
                  {content.message || t('abTests.previewWelcomeMessage', 'We are excited to have you here. How can we help you today?')}
                </p>
                <button
                  className="w-full py-3 text-white rounded-lg font-medium"
                  style={{ backgroundColor: content.primaryColor || '#7c3aed' }}
                >
                  {content.ctaText || t('abTests.previewWelcomeCta', 'Get Started')}
                </button>
              </div>
            </div>
          </div>
        );

      case 'flow':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Layout className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                {t('abTests.flowPreview', 'Flow Preview')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {content.flowId
                  ? t('abTests.flowIdSelected', `Flow ID: ${content.flowId}`)
                  : t('abTests.noFlowSelected', 'No flow selected')
                }
              </p>
            </div>
          </div>
        );

      case 'tour':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MousePointer className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                {t('abTests.tourPreview', 'Tour Preview')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {content.tourId
                  ? t('abTests.tourIdSelected', `Tour ID: ${content.tourId}`)
                  : t('abTests.noTourSelected', 'No tour selected')
                }
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {t('abTests.selectTestType', 'Select a test type to see preview')}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Preview Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {t('abTests.preview', 'Preview')}
          </h3>

          {/* Device Switcher */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-900 rounded-lg p-1">
            <button
              onClick={() => setDevice('desktop')}
              className={`p-1.5 rounded ${device === 'desktop' ? 'bg-white dark:bg-slate-700 shadow' : ''}`}
            >
              <Monitor className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setDevice('tablet')}
              className={`p-1.5 rounded ${device === 'tablet' ? 'bg-white dark:bg-slate-700 shadow' : ''}`}
            >
              <Tablet className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`p-1.5 rounded ${device === 'mobile' ? 'bg-white dark:bg-slate-700 shadow' : ''}`}
            >
              <Smartphone className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Variant Switcher */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onVariantChange(Math.max(0, selectedVariantIndex - 1))}
            disabled={selectedVariantIndex === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2">
            {variants.map((variant, index) => (
              <button
                key={variant.id}
                onClick={() => onVariantChange(index)}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                  ${selectedVariantIndex === index
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700'
                  }
                `}
              >
                {variant.name}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onVariantChange(Math.min(variants.length - 1, selectedVariantIndex + 1))}
            disabled={selectedVariantIndex === variants.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 p-4 bg-gray-100 dark:bg-slate-900 overflow-auto">
        <div
          className="mx-auto h-full bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden transition-all duration-300"
          style={DEVICE_SIZES[device]}
        >
          {/* Mock Browser Header */}
          <div className="bg-gray-200 dark:bg-slate-700 px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-white dark:bg-slate-600 rounded px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
                yoursite.com
              </div>
            </div>
          </div>

          {/* Preview Content */}
          <div className="h-[calc(100%-40px)] bg-gray-50 dark:bg-slate-900 relative">
            {renderPreviewContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

/**
 * Theme Editor Component
 * Customize tour appearance with live preview
 */
export default function ThemeEditor({ tourId, initialTheme, onSave, onApply }) {
  const { t } = useTranslation();
  const [themes, setThemes] = useState({ system: [], custom: [] });
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [customTheme, setCustomTheme] = useState({
    name: '',
    colors: {
      primary: '#3B82F6',
      secondary: '#6366F1',
      background: '#FFFFFF',
      text: '#1F2937',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      overlay: 'rgba(0, 0, 0, 0.5)'
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      titleSize: '18px',
      contentSize: '14px',
      buttonSize: '14px'
    },
    styling: {
      borderRadius: '8px',
      tooltipStyle: 'light',
      buttonStyle: 'filled',
      overlayOpacity: 0.5
    },
    animation: {
      type: 'fade',
      duration: 300,
      easing: 'ease-out'
    }
  });
  const [options, setOptions] = useState({
    animationTypes: [],
    tooltipStyles: [],
    buttonStyles: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('colors');

  useEffect(() => {
    loadThemes();
    loadOptions();
    if (initialTheme) {
      setCustomTheme(prev => ({ ...prev, ...initialTheme }));
    }
  }, [initialTheme]);

  const loadThemes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tours/themes');
      if (res.data.success) {
        setThemes({
          system: res.data.system || [],
          custom: res.data.custom || []
        });
      }
    } catch (err) {
      console.error('Failed to load themes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const res = await api.get('/tours/themes/options');
      if (res.data.success) {
        setOptions({
          animationTypes: res.data.animationTypes || [],
          tooltipStyles: res.data.tooltipStyles || [],
          buttonStyles: res.data.buttonStyles || []
        });
      }
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  };

  const handleSelectTheme = async (theme) => {
    setSelectedTheme(theme);
    setCustomTheme({
      name: theme.name,
      colors: theme.colors || {},
      typography: theme.typography || {},
      styling: theme.styling || {},
      animation: theme.animation || {}
    });

    // Apply theme to tour if tourId exists
    if (tourId && onApply) {
      try {
        await api.post(`/tours/${tourId}/apply-theme`, { themeId: theme.id });
        onApply(theme);
      } catch (err) {
        console.error('Failed to apply theme:', err);
      }
    }
  };

  const handleColorChange = (key, value) => {
    setCustomTheme(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: value }
    }));
  };

  const handleTypographyChange = (key, value) => {
    setCustomTheme(prev => ({
      ...prev,
      typography: { ...prev.typography, [key]: value }
    }));
  };

  const handleStylingChange = (key, value) => {
    setCustomTheme(prev => ({
      ...prev,
      styling: { ...prev.styling, [key]: value }
    }));
  };

  const handleAnimationChange = (key, value) => {
    setCustomTheme(prev => ({
      ...prev,
      animation: { ...prev.animation, [key]: value }
    }));
  };

  const handleSaveTheme = async () => {
    if (!customTheme.name.trim()) return;

    setSaving(true);
    try {
      const res = await api.post('/tours/themes', customTheme);
      if (res.data.success) {
        loadThemes();
        if (onSave) onSave(res.data.theme);
      }
    } catch (err) {
      console.error('Failed to save theme:', err);
    } finally {
      setSaving(false);
    }
  };

  const fontFamilies = [
    'Inter, system-ui, sans-serif',
    'Roboto, system-ui, sans-serif',
    'Poppins, system-ui, sans-serif',
    'Nunito, system-ui, sans-serif',
    'system-ui, sans-serif',
    'Georgia, serif',
    'Monaco, monospace'
  ];

  const ColorPicker = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
      <label className="text-sm text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex items-center space-x-2">
        <input
          type="color"
          value={value?.startsWith('rgba') ? '#000000' : value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-gray-300"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
    </div>
  );

  // Live Preview Component
  const LivePreview = () => (
    <div
      className="rounded-lg p-4 relative overflow-hidden"
      style={{
        backgroundColor: customTheme.colors.overlay,
        minHeight: '200px'
      }}
    >
      <div
        className="absolute inset-4 rounded-lg shadow-lg p-4"
        style={{
          backgroundColor: customTheme.colors.background,
          borderRadius: customTheme.styling.borderRadius,
          fontFamily: customTheme.typography.fontFamily
        }}
      >
        <h4
          style={{
            color: customTheme.colors.text,
            fontSize: customTheme.typography.titleSize,
            marginBottom: '8px'
          }}
        >
          {t('tours.previewTitle', 'Welcome to the Tour!')}
        </h4>
        <p
          style={{
            color: customTheme.colors.textSecondary,
            fontSize: customTheme.typography.contentSize,
            marginBottom: '16px'
          }}
        >
          {t('tours.previewContent', 'This is how your tour will look with the current theme settings.')}
        </p>
        <div className="flex space-x-2">
          <button
            style={{
              backgroundColor: customTheme.styling.buttonStyle === 'filled' ? customTheme.colors.primary : 'transparent',
              color: customTheme.styling.buttonStyle === 'filled' ? '#FFFFFF' : customTheme.colors.primary,
              border: customTheme.styling.buttonStyle === 'outline' ? `2px solid ${customTheme.colors.primary}` : 'none',
              borderRadius: customTheme.styling.borderRadius,
              padding: '8px 16px',
              fontSize: customTheme.typography.buttonSize
            }}
          >
            {t('tours.next', 'Next')}
          </button>
          <button
            style={{
              backgroundColor: 'transparent',
              color: customTheme.colors.textSecondary,
              padding: '8px 16px',
              fontSize: customTheme.typography.buttonSize
            }}
          >
            {t('tours.skip', 'Skip')}
          </button>
        </div>
        <div
          className="absolute bottom-4 left-4 right-4 h-1 rounded"
          style={{ backgroundColor: customTheme.colors.border }}
        >
          <div
            className="h-full rounded"
            style={{
              backgroundColor: customTheme.colors.primary,
              width: '40%'
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('tours.themeEditor', 'Theme Editor')}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tours.themeEditorDesc', 'Customize the appearance of your tours')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Left Panel - Theme Selection & Editor */}
        <div className="space-y-6">
          {/* Preset Themes */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('tours.presetThemes', 'Preset Themes')}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {themes.system.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedTheme?.id === theme.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }`}
                >
                  <div
                    className="w-full h-6 rounded mb-2"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors?.primary || '#3B82F6'}, ${theme.colors?.secondary || '#6366F1'})`
                    }}
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor Tabs */}
          <div>
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {['colors', 'typography', 'styling', 'animation'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors capitalize ${
                    activeTab === tab
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {t(`tours.${tab}`, tab)}
                </button>
              ))}
            </div>

            {/* Colors Tab */}
            {activeTab === 'colors' && (
              <div className="mt-4 space-y-4">
                <ColorPicker
                  label={t('tours.primaryColor', 'Primary Color')}
                  value={customTheme.colors.primary}
                  onChange={(v) => handleColorChange('primary', v)}
                />
                <ColorPicker
                  label={t('tours.secondaryColor', 'Secondary Color')}
                  value={customTheme.colors.secondary}
                  onChange={(v) => handleColorChange('secondary', v)}
                />
                <ColorPicker
                  label={t('tours.backgroundColor', 'Background')}
                  value={customTheme.colors.background}
                  onChange={(v) => handleColorChange('background', v)}
                />
                <ColorPicker
                  label={t('tours.textColor', 'Text Color')}
                  value={customTheme.colors.text}
                  onChange={(v) => handleColorChange('text', v)}
                />
                <ColorPicker
                  label={t('tours.borderColor', 'Border Color')}
                  value={customTheme.colors.border}
                  onChange={(v) => handleColorChange('border', v)}
                />
              </div>
            )}

            {/* Typography Tab */}
            {activeTab === 'typography' && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {t('tours.fontFamily', 'Font Family')}
                  </label>
                  <select
                    value={customTheme.typography.fontFamily}
                    onChange={(e) => handleTypographyChange('fontFamily', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {fontFamilies.map((font) => (
                      <option key={font} value={font}>{font.split(',')[0]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {t('tours.titleSize', 'Title Size')}: {customTheme.typography.titleSize}
                  </label>
                  <input
                    type="range"
                    min="14"
                    max="28"
                    value={parseInt(customTheme.typography.titleSize)}
                    onChange={(e) => handleTypographyChange('titleSize', `${e.target.value}px`)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {t('tours.contentSize', 'Content Size')}: {customTheme.typography.contentSize}
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="20"
                    value={parseInt(customTheme.typography.contentSize)}
                    onChange={(e) => handleTypographyChange('contentSize', `${e.target.value}px`)}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Styling Tab */}
            {activeTab === 'styling' && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {t('tours.borderRadius', 'Border Radius')}: {customTheme.styling.borderRadius}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={parseInt(customTheme.styling.borderRadius)}
                    onChange={(e) => handleStylingChange('borderRadius', `${e.target.value}px`)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {t('tours.tooltipStyle', 'Tooltip Style')}
                  </label>
                  <select
                    value={customTheme.styling.tooltipStyle}
                    onChange={(e) => handleStylingChange('tooltipStyle', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {options.tooltipStyles.map((style) => (
                      <option key={style.id} value={style.id}>{style.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {t('tours.buttonStyle', 'Button Style')}
                  </label>
                  <select
                    value={customTheme.styling.buttonStyle}
                    onChange={(e) => handleStylingChange('buttonStyle', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {options.buttonStyles.map((style) => (
                      <option key={style.id} value={style.id}>{style.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {t('tours.overlayOpacity', 'Overlay Opacity')}: {customTheme.styling.overlayOpacity}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={customTheme.styling.overlayOpacity}
                    onChange={(e) => handleStylingChange('overlayOpacity', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Animation Tab */}
            {activeTab === 'animation' && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {t('tours.animationType', 'Animation Type')}
                  </label>
                  <select
                    value={customTheme.animation.type}
                    onChange={(e) => handleAnimationChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {options.animationTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    {t('tours.animationDuration', 'Duration')}: {customTheme.animation.duration}ms
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={customTheme.animation.duration}
                    onChange={(e) => handleAnimationChange('duration', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Save Theme */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('tours.themeName', 'Theme Name')}
              </label>
              <input
                type="text"
                value={customTheme.name}
                onChange={(e) => setCustomTheme(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={t('tours.enterThemeName', 'Enter theme name')}
              />
            </div>
            <button
              onClick={handleSaveTheme}
              disabled={saving || !customTheme.name.trim()}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? t('tours.saving', 'Saving...') : t('tours.saveTheme', 'Save Theme')}
            </button>
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('tours.livePreview', 'Live Preview')}
          </h3>
          <LivePreview />

          {/* Custom Themes */}
          {themes.custom.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {t('tours.customThemes', 'Custom Themes')}
              </h3>
              <div className="space-y-2">
                {themes.custom.map((theme) => (
                  <div
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTheme?.id === theme.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-8 h-8 rounded"
                        style={{
                          background: `linear-gradient(135deg, ${theme.colors?.primary || '#3B82F6'}, ${theme.colors?.secondary || '#6366F1'})`
                        }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {theme.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(theme.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

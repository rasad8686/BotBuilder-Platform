import React, { useState } from 'react';
import {
  Palette,
  Type,
  Image,
  Layout,
  Maximize2,
  Monitor,
  Smartphone,
  Square,
  Circle,
  Upload,
  Trash2,
  Eye,
  RefreshCw,
  Sun,
  Moon,
  Sliders
} from 'lucide-react';

const SurveyStyleEditor = ({ style = {}, onChange, readonly = false }) => {
  const [activeTab, setActiveTab] = useState('colors');
  const [previewMode, setPreviewMode] = useState('desktop');
  const [darkMode, setDarkMode] = useState(false);

  const defaultStyle = {
    // Colors
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    accentColor: '#10b981',
    errorColor: '#ef4444',
    // Typography
    fontFamily: 'Inter',
    headingSize: 24,
    bodySize: 16,
    buttonSize: 14,
    // Branding
    logo: null,
    logoPosition: 'top-left',
    favicon: null,
    // Layout
    layout: 'centered', // centered, fullwidth, card
    maxWidth: 640,
    padding: 32,
    borderRadius: 12,
    // Buttons
    buttonStyle: 'filled', // filled, outlined, text
    buttonRadius: 8,
    // Progress
    showProgress: true,
    progressStyle: 'bar', // bar, steps, percentage
    progressColor: '#6366f1',
    // Background
    backgroundType: 'solid', // solid, gradient, image
    backgroundGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundImage: null,
    ...style
  };

  const [localStyle, setLocalStyle] = useState(defaultStyle);

  const updateStyle = (field, value) => {
    if (readonly) return;
    const updated = { ...localStyle, [field]: value };
    setLocalStyle(updated);
    onChange?.(updated);
  };

  const fontFamilies = [
    'Inter',
    'Roboto',
    'Open Sans',
    'Lato',
    'Poppins',
    'Montserrat',
    'Raleway',
    'Nunito',
    'Source Sans Pro',
    'Playfair Display'
  ];

  const presetThemes = [
    {
      name: 'Default',
      colors: {
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        backgroundColor: '#ffffff',
        textColor: '#1f2937'
      }
    },
    {
      name: 'Ocean',
      colors: {
        primaryColor: '#0ea5e9',
        secondaryColor: '#06b6d4',
        backgroundColor: '#f0f9ff',
        textColor: '#0c4a6e'
      }
    },
    {
      name: 'Forest',
      colors: {
        primaryColor: '#22c55e',
        secondaryColor: '#16a34a',
        backgroundColor: '#f0fdf4',
        textColor: '#14532d'
      }
    },
    {
      name: 'Sunset',
      colors: {
        primaryColor: '#f97316',
        secondaryColor: '#fb923c',
        backgroundColor: '#fff7ed',
        textColor: '#7c2d12'
      }
    },
    {
      name: 'Rose',
      colors: {
        primaryColor: '#ec4899',
        secondaryColor: '#f472b6',
        backgroundColor: '#fdf2f8',
        textColor: '#831843'
      }
    },
    {
      name: 'Dark',
      colors: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#a78bfa',
        backgroundColor: '#1f2937',
        textColor: '#f9fafb'
      }
    }
  ];

  const applyTheme = (theme) => {
    if (readonly) return;
    Object.entries(theme.colors).forEach(([key, value]) => {
      updateStyle(key, value);
    });
  };

  const tabs = [
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'typography', label: 'Typography', icon: Type },
    { id: 'branding', label: 'Branding', icon: Image },
    { id: 'layout', label: 'Layout', icon: Layout },
    { id: 'buttons', label: 'Buttons', icon: Square }
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-rose-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
              <Palette className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Style Editor</h3>
              <p className="text-sm text-gray-500">Customize the look and feel of your survey</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPreviewMode('desktop')}
                className={`p-2 rounded ${previewMode === 'desktop' ? 'bg-white shadow' : ''}`}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewMode('mobile')}
                className={`p-2 rounded ${previewMode === 'mobile' ? 'bg-white shadow' : ''}`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}
            >
              {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Tabs */}
        <div className="w-48 border-r border-gray-200 bg-gray-50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-pink-600 border-r-2 border-pink-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {/* Colors Tab */}
          {activeTab === 'colors' && (
            <div className="space-y-6">
              {/* Preset Themes */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Preset Themes</h4>
                <div className="grid grid-cols-3 gap-3">
                  {presetThemes.map((theme) => (
                    <button
                      key={theme.name}
                      onClick={() => applyTheme(theme)}
                      disabled={readonly}
                      className="p-3 border border-gray-200 rounded-lg hover:border-pink-300 transition-colors"
                    >
                      <div className="flex gap-1 mb-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: theme.colors.primaryColor }}
                        />
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: theme.colors.secondaryColor }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: theme.colors.backgroundColor }}
                        />
                      </div>
                      <p className="text-xs text-gray-600">{theme.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Colors */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'primaryColor', label: 'Primary' },
                  { key: 'secondaryColor', label: 'Secondary' },
                  { key: 'backgroundColor', label: 'Background' },
                  { key: 'textColor', label: 'Text' },
                  { key: 'accentColor', label: 'Accent' },
                  { key: 'errorColor', label: 'Error' }
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {label} Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={localStyle[key]}
                        onChange={(e) => updateStyle(key, e.target.value)}
                        disabled={readonly}
                        className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={localStyle[key]}
                        onChange={(e) => updateStyle(key, e.target.value)}
                        disabled={readonly}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Background Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Background Type
                </label>
                <div className="flex gap-2">
                  {['solid', 'gradient', 'image'].map((type) => (
                    <button
                      key={type}
                      onClick={() => updateStyle('backgroundType', type)}
                      disabled={readonly}
                      className={`px-4 py-2 rounded-lg text-sm capitalize ${
                        localStyle.backgroundType === type
                          ? 'bg-pink-100 text-pink-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {localStyle.backgroundType === 'gradient' && (
                  <input
                    type="text"
                    value={localStyle.backgroundGradient}
                    onChange={(e) => updateStyle('backgroundGradient', e.target.value)}
                    placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    disabled={readonly}
                    className="w-full mt-3 px-4 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                )}
              </div>
            </div>
          )}

          {/* Typography Tab */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Font Family
                </label>
                <select
                  value={localStyle.fontFamily}
                  onChange={(e) => updateStyle('fontFamily', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  {fontFamilies.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              {[
                { key: 'headingSize', label: 'Heading Size', min: 16, max: 48 },
                { key: 'bodySize', label: 'Body Size', min: 12, max: 24 },
                { key: 'buttonSize', label: 'Button Size', min: 12, max: 20 }
              ].map(({ key, label, min, max }) => (
                <div key={key}>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">{label}</label>
                    <span className="text-sm text-gray-500">{localStyle[key]}px</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={localStyle[key]}
                    onChange={(e) => updateStyle(key, parseInt(e.target.value))}
                    disabled={readonly}
                    className="w-full"
                  />
                </div>
              ))}

              {/* Preview */}
              <div
                className="p-6 bg-gray-50 rounded-lg"
                style={{ fontFamily: localStyle.fontFamily }}
              >
                <h3 style={{ fontSize: localStyle.headingSize, color: localStyle.textColor }}>
                  Sample Heading
                </h3>
                <p style={{ fontSize: localStyle.bodySize, color: localStyle.textColor }} className="mt-2">
                  This is sample body text to preview your typography settings.
                </p>
                <button
                  style={{
                    fontSize: localStyle.buttonSize,
                    backgroundColor: localStyle.primaryColor,
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: localStyle.buttonRadius
                  }}
                  className="mt-4"
                >
                  Sample Button
                </button>
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo
                </label>
                {localStyle.logo ? (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <img
                      src={localStyle.logo}
                      alt="Logo"
                      className="h-12 object-contain"
                    />
                    {!readonly && (
                      <button
                        onClick={() => updateStyle('logo', null)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-pink-400 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PNG, JPG, SVG up to 2MB
                    </p>
                  </div>
                )}
              </div>

              {/* Logo Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo Position
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['top-left', 'top-center', 'top-right'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => updateStyle('logoPosition', pos)}
                      disabled={readonly}
                      className={`px-4 py-2 rounded-lg text-sm capitalize ${
                        localStyle.logoPosition === pos
                          ? 'bg-pink-100 text-pink-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {pos.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localStyle.showProgress}
                    onChange={(e) => updateStyle('showProgress', e.target.checked)}
                    disabled={readonly}
                    className="w-5 h-5 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Show Progress Indicator</span>
                </label>

                {localStyle.showProgress && (
                  <div className="mt-4 pl-8 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Progress Style
                      </label>
                      <div className="flex gap-2">
                        {['bar', 'steps', 'percentage'].map((style) => (
                          <button
                            key={style}
                            onClick={() => updateStyle('progressStyle', style)}
                            disabled={readonly}
                            className={`px-4 py-2 rounded-lg text-sm capitalize ${
                              localStyle.progressStyle === style
                                ? 'bg-pink-100 text-pink-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Progress Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={localStyle.progressColor}
                          onChange={(e) => updateStyle('progressColor', e.target.value)}
                          disabled={readonly}
                          className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={localStyle.progressColor}
                          onChange={(e) => updateStyle('progressColor', e.target.value)}
                          disabled={readonly}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Layout Tab */}
          {activeTab === 'layout' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Layout Style
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'centered', label: 'Centered', icon: '📦' },
                    { value: 'fullwidth', label: 'Full Width', icon: '📐' },
                    { value: 'card', label: 'Card', icon: '🃏' }
                  ].map((layout) => (
                    <button
                      key={layout.value}
                      onClick={() => updateStyle('layout', layout.value)}
                      disabled={readonly}
                      className={`p-4 rounded-lg border-2 transition-all text-center ${
                        localStyle.layout === layout.value
                          ? 'border-pink-500 bg-pink-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{layout.icon}</span>
                      <p className="text-sm font-medium text-gray-700 mt-2">{layout.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Max Width</label>
                  <span className="text-sm text-gray-500">{localStyle.maxWidth}px</span>
                </div>
                <input
                  type="range"
                  min={400}
                  max={1200}
                  step={40}
                  value={localStyle.maxWidth}
                  onChange={(e) => updateStyle('maxWidth', parseInt(e.target.value))}
                  disabled={readonly}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Padding</label>
                  <span className="text-sm text-gray-500">{localStyle.padding}px</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={64}
                  step={8}
                  value={localStyle.padding}
                  onChange={(e) => updateStyle('padding', parseInt(e.target.value))}
                  disabled={readonly}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Border Radius</label>
                  <span className="text-sm text-gray-500">{localStyle.borderRadius}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={localStyle.borderRadius}
                  onChange={(e) => updateStyle('borderRadius', parseInt(e.target.value))}
                  disabled={readonly}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Buttons Tab */}
          {activeTab === 'buttons' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Button Style
                </label>
                <div className="flex gap-3">
                  {['filled', 'outlined', 'text'].map((btnStyle) => (
                    <button
                      key={btnStyle}
                      onClick={() => updateStyle('buttonStyle', btnStyle)}
                      disabled={readonly}
                      className={`flex-1 py-3 rounded-lg text-sm capitalize transition-all ${
                        localStyle.buttonStyle === btnStyle
                          ? 'ring-2 ring-pink-500 ring-offset-2'
                          : ''
                      } ${
                        btnStyle === 'filled'
                          ? 'bg-pink-600 text-white'
                          : btnStyle === 'outlined'
                          ? 'border-2 border-pink-600 text-pink-600'
                          : 'text-pink-600'
                      }`}
                    >
                      {btnStyle}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Button Radius</label>
                  <span className="text-sm text-gray-500">{localStyle.buttonRadius}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={localStyle.buttonRadius}
                  onChange={(e) => updateStyle('buttonRadius', parseInt(e.target.value))}
                  disabled={readonly}
                  className="w-full"
                />
              </div>

              {/* Button Preview */}
              <div className="p-6 bg-gray-50 rounded-lg space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Preview</h4>
                <div className="flex flex-wrap gap-3">
                  {localStyle.buttonStyle === 'filled' && (
                    <>
                      <button
                        style={{
                          backgroundColor: localStyle.primaryColor,
                          borderRadius: localStyle.buttonRadius,
                          fontSize: localStyle.buttonSize
                        }}
                        className="px-6 py-2 text-white"
                      >
                        Primary Button
                      </button>
                      <button
                        style={{
                          backgroundColor: localStyle.secondaryColor,
                          borderRadius: localStyle.buttonRadius,
                          fontSize: localStyle.buttonSize
                        }}
                        className="px-6 py-2 text-white"
                      >
                        Secondary Button
                      </button>
                    </>
                  )}
                  {localStyle.buttonStyle === 'outlined' && (
                    <>
                      <button
                        style={{
                          borderColor: localStyle.primaryColor,
                          color: localStyle.primaryColor,
                          borderRadius: localStyle.buttonRadius,
                          fontSize: localStyle.buttonSize
                        }}
                        className="px-6 py-2 border-2"
                      >
                        Primary Button
                      </button>
                      <button
                        style={{
                          borderColor: localStyle.secondaryColor,
                          color: localStyle.secondaryColor,
                          borderRadius: localStyle.buttonRadius,
                          fontSize: localStyle.buttonSize
                        }}
                        className="px-6 py-2 border-2"
                      >
                        Secondary Button
                      </button>
                    </>
                  )}
                  {localStyle.buttonStyle === 'text' && (
                    <>
                      <button
                        style={{
                          color: localStyle.primaryColor,
                          fontSize: localStyle.buttonSize
                        }}
                        className="px-6 py-2"
                      >
                        Primary Button
                      </button>
                      <button
                        style={{
                          color: localStyle.secondaryColor,
                          fontSize: localStyle.buttonSize
                        }}
                        className="px-6 py-2"
                      >
                        Secondary Button
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <button
          onClick={() => setLocalStyle(defaultStyle)}
          disabled={readonly}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Reset to Default
        </button>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700">
            Save Style
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyStyleEditor;

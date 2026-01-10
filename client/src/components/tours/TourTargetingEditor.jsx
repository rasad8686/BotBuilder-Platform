/**
 * Tour Targeting Editor Component
 * Allows configuration of targeting rules for product tours
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Target,
  Globe,
  Users,
  Monitor,
  Smartphone,
  Tablet,
  Chrome,
  Clock,
  MousePointer,
  Calendar,
  Plus,
  Trash2,
  Save,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Settings
} from 'lucide-react';
import axios from '../../api/axios';

const MATCH_TYPES = [
  { value: 'exact', label: 'Exact Match' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'regex', label: 'Regex Pattern' },
  { value: 'not_contains', label: 'Does Not Contain' }
];

const SEGMENT_TYPES = [
  { value: 'all', label: 'All Users' },
  { value: 'new_users', label: 'New Users (last 7 days)' },
  { value: 'returning', label: 'Returning Users' },
  { value: 'premium', label: 'Premium Users' },
  { value: 'trial', label: 'Trial Users' },
  { value: 'free', label: 'Free Users' },
  { value: 'custom', label: 'Custom Segment' }
];

const DEVICES = [
  { value: 'desktop', label: 'Desktop', icon: Monitor },
  { value: 'mobile', label: 'Mobile', icon: Smartphone },
  { value: 'tablet', label: 'Tablet', icon: Tablet }
];

const BROWSERS = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'safari', label: 'Safari' },
  { value: 'edge', label: 'Edge' },
  { value: 'opera', label: 'Opera' }
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'exists', label: 'Exists' },
  { value: 'not_exists', label: 'Does Not Exist' }
];

const FREQUENCY_TYPES = [
  { value: 'once', label: 'Show Once' },
  { value: 'unlimited', label: 'Unlimited' },
  { value: 'limited', label: 'Limited' }
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

export default function TourTargetingEditor({ tourId, onSave, initialRules = {} }) {
  const { t } = useTranslation();
  const [rules, setRules] = useState({
    url_rules: { match_type: 'contains', patterns: [] },
    user_segment: { type: 'all' },
    device_rules: { allowed_devices: ['desktop', 'mobile', 'tablet'] },
    browser_rules: { allowed_browsers: [] },
    user_properties: [],
    datetime_rules: {},
    frequency: { type: 'once' },
    ...initialRules
  });

  const [expandedSections, setExpandedSections] = useState({
    url: true,
    segment: false,
    device: false,
    browser: false,
    properties: false,
    datetime: false,
    frequency: false
  });

  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [testContext, setTestContext] = useState({
    currentUrl: window.location.href,
    userAgent: navigator.userAgent
  });

  useEffect(() => {
    fetchSegments();
    if (tourId) {
      fetchTargetingRules();
    }
  }, [tourId]);

  const fetchSegments = async () => {
    try {
      const res = await axios.get('/api/tours/segments');
      if (res.data.success) {
        setSegments(res.data.segments || []);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const fetchTargetingRules = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/tours/${tourId}/targeting`);
      if (res.data.success && res.data.targeting?.rules) {
        setRules(prev => ({ ...prev, ...res.data.targeting.rules }));
      }
    } catch (error) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.post(`/api/tours/${tourId}/targeting`, rules);
      if (res.data.success) {
        onSave?.(rules);
      }
    } catch (error) {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await axios.post(`/api/tours/${tourId}/targeting/test`, testContext);
      if (res.data.success) {
        setTestResults(res.data.results);
      }
    } catch (error) {
      setTestResults({ error: true });
    } finally {
      setTesting(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // URL Rules
  const addUrlPattern = () => {
    setRules(prev => ({
      ...prev,
      url_rules: {
        ...prev.url_rules,
        patterns: [...(prev.url_rules?.patterns || []), '']
      }
    }));
  };

  const updateUrlPattern = (index, value) => {
    setRules(prev => ({
      ...prev,
      url_rules: {
        ...prev.url_rules,
        patterns: prev.url_rules.patterns.map((p, i) => i === index ? value : p)
      }
    }));
  };

  const removeUrlPattern = (index) => {
    setRules(prev => ({
      ...prev,
      url_rules: {
        ...prev.url_rules,
        patterns: prev.url_rules.patterns.filter((_, i) => i !== index)
      }
    }));
  };

  // User Properties
  const addUserProperty = () => {
    setRules(prev => ({
      ...prev,
      user_properties: [
        ...(prev.user_properties || []),
        { property: '', operator: 'equals', value: '' }
      ]
    }));
  };

  const updateUserProperty = (index, field, value) => {
    setRules(prev => ({
      ...prev,
      user_properties: prev.user_properties.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      )
    }));
  };

  const removeUserProperty = (index) => {
    setRules(prev => ({
      ...prev,
      user_properties: prev.user_properties.filter((_, i) => i !== index)
    }));
  };

  // Devices
  const toggleDevice = (device) => {
    setRules(prev => {
      const current = prev.device_rules?.allowed_devices || [];
      const updated = current.includes(device)
        ? current.filter(d => d !== device)
        : [...current, device];
      return {
        ...prev,
        device_rules: { ...prev.device_rules, allowed_devices: updated }
      };
    });
  };

  // Browsers
  const toggleBrowser = (browser) => {
    setRules(prev => {
      const current = prev.browser_rules?.allowed_browsers || [];
      const updated = current.includes(browser)
        ? current.filter(b => b !== browser)
        : [...current, browser];
      return {
        ...prev,
        browser_rules: { ...prev.browser_rules, allowed_browsers: updated }
      };
    });
  };

  // Days of week
  const toggleDay = (day) => {
    setRules(prev => {
      const current = prev.datetime_rules?.days_of_week || [];
      const updated = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
      return {
        ...prev,
        datetime_rules: { ...prev.datetime_rules, days_of_week: updated }
      };
    });
  };

  const SectionHeader = ({ title, icon: Icon, section, badge }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-purple-500" />
        <span className="font-medium text-gray-900 dark:text-white">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {expandedSections[section] ? (
        <ChevronDown className="w-5 h-5 text-gray-400" />
      ) : (
        <ChevronRight className="w-5 h-5 text-gray-400" />
      )}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('tours.targeting.title', 'Targeting Rules')}
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            {t('tours.targeting.test', 'Test')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className={`p-4 rounded-lg ${
          testResults.overall
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {testResults.overall ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className={`font-medium ${testResults.overall ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {testResults.overall
                ? t('tours.targeting.testPassed', 'All targeting rules passed')
                : t('tours.targeting.testFailed', 'Some targeting rules failed')}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {Object.entries(testResults).filter(([k]) => k !== 'overall' && k !== 'error').map(([key, passed]) => (
              <div key={key} className="flex items-center gap-1">
                {passed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-gray-600 dark:text-gray-400 capitalize">{key.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* URL Rules */}
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <SectionHeader
          title={t('tours.targeting.urlRules', 'URL Rules')}
          icon={Globe}
          section="url"
          badge={rules.url_rules?.patterns?.length || null}
        />
        {expandedSections.url && (
          <div className="p-4 space-y-4 border-t border-gray-200 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tours.targeting.matchType', 'Match Type')}
              </label>
              <select
                value={rules.url_rules?.match_type || 'contains'}
                onChange={(e) => setRules(prev => ({
                  ...prev,
                  url_rules: { ...prev.url_rules, match_type: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              >
                {MATCH_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tours.targeting.urlPatterns', 'URL Patterns')}
              </label>
              <div className="space-y-2">
                {(rules.url_rules?.patterns || []).map((pattern, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={pattern}
                      onChange={(e) => updateUrlPattern(index, e.target.value)}
                      placeholder="/dashboard, /settings/*"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={() => removeUrlPattern(index)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addUrlPattern}
                className="mt-2 flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700"
              >
                <Plus className="w-4 h-4" />
                {t('tours.targeting.addPattern', 'Add Pattern')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Segment */}
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <SectionHeader
          title={t('tours.targeting.userSegment', 'User Segment')}
          icon={Users}
          section="segment"
        />
        {expandedSections.segment && (
          <div className="p-4 space-y-4 border-t border-gray-200 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tours.targeting.segmentType', 'Segment Type')}
              </label>
              <select
                value={rules.user_segment?.type || 'all'}
                onChange={(e) => setRules(prev => ({
                  ...prev,
                  user_segment: { ...prev.user_segment, type: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              >
                {SEGMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {rules.user_segment?.type === 'custom' && segments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('tours.targeting.customSegment', 'Custom Segment')}
                </label>
                <select
                  value={rules.user_segment?.custom_segment_id || ''}
                  onChange={(e) => setRules(prev => ({
                    ...prev,
                    user_segment: { ...prev.user_segment, custom_segment_id: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select segment...</option>
                  {segments.map(seg => (
                    <option key={seg.id} value={seg.id}>{seg.name} ({seg.user_count} users)</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Device Rules */}
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <SectionHeader
          title={t('tours.targeting.deviceRules', 'Device Type')}
          icon={Monitor}
          section="device"
        />
        {expandedSections.device && (
          <div className="p-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex flex-wrap gap-3">
              {DEVICES.map(device => {
                const Icon = device.icon;
                const isSelected = rules.device_rules?.allowed_devices?.includes(device.value);
                return (
                  <button
                    key={device.value}
                    onClick={() => toggleDevice(device.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-600 dark:text-purple-400'
                        : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {device.label}
                    {isSelected && <CheckCircle className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Browser Rules */}
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <SectionHeader
          title={t('tours.targeting.browserRules', 'Browser')}
          icon={Chrome}
          section="browser"
        />
        {expandedSections.browser && (
          <div className="p-4 border-t border-gray-200 dark:border-slate-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {t('tours.targeting.browserNote', 'Leave empty to allow all browsers')}
            </p>
            <div className="flex flex-wrap gap-2">
              {BROWSERS.map(browser => {
                const isSelected = rules.browser_rules?.allowed_browsers?.includes(browser.value);
                return (
                  <button
                    key={browser.value}
                    onClick={() => toggleBrowser(browser.value)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-600 dark:text-purple-400'
                        : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {browser.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* User Properties */}
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <SectionHeader
          title={t('tours.targeting.userProperties', 'User Properties')}
          icon={Settings}
          section="properties"
          badge={rules.user_properties?.length || null}
        />
        {expandedSections.properties && (
          <div className="p-4 border-t border-gray-200 dark:border-slate-700">
            <div className="space-y-3">
              {(rules.user_properties || []).map((prop, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={prop.property}
                    onChange={(e) => updateUserProperty(index, 'property', e.target.value)}
                    placeholder="Property name"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                  />
                  <select
                    value={prop.operator}
                    onChange={(e) => updateUserProperty(index, 'operator', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={prop.value}
                    onChange={(e) => updateUserProperty(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={() => removeUserProperty(index)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addUserProperty}
              className="mt-3 flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700"
            >
              <Plus className="w-4 h-4" />
              {t('tours.targeting.addProperty', 'Add Property Rule')}
            </button>
          </div>
        )}
      </div>

      {/* Date/Time Rules */}
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <SectionHeader
          title={t('tours.targeting.datetimeRules', 'Date & Time')}
          icon={Calendar}
          section="datetime"
        />
        {expandedSections.datetime && (
          <div className="p-4 space-y-4 border-t border-gray-200 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('tours.targeting.startDate', 'Start Date')}
                </label>
                <input
                  type="date"
                  value={rules.datetime_rules?.start_date || ''}
                  onChange={(e) => setRules(prev => ({
                    ...prev,
                    datetime_rules: { ...prev.datetime_rules, start_date: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('tours.targeting.endDate', 'End Date')}
                </label>
                <input
                  type="date"
                  value={rules.datetime_rules?.end_date || ''}
                  onChange={(e) => setRules(prev => ({
                    ...prev,
                    datetime_rules: { ...prev.datetime_rules, end_date: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('tours.targeting.startTime', 'Start Time')}
                </label>
                <input
                  type="time"
                  value={rules.datetime_rules?.time_range?.start_time || ''}
                  onChange={(e) => setRules(prev => ({
                    ...prev,
                    datetime_rules: {
                      ...prev.datetime_rules,
                      time_range: { ...prev.datetime_rules?.time_range, start_time: e.target.value }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('tours.targeting.endTime', 'End Time')}
                </label>
                <input
                  type="time"
                  value={rules.datetime_rules?.time_range?.end_time || ''}
                  onChange={(e) => setRules(prev => ({
                    ...prev,
                    datetime_rules: {
                      ...prev.datetime_rules,
                      time_range: { ...prev.datetime_rules?.time_range, end_time: e.target.value }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tours.targeting.daysOfWeek', 'Days of Week')}
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(day => {
                  const isSelected = rules.datetime_rules?.days_of_week?.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-600 dark:text-purple-400'
                          : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Frequency */}
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <SectionHeader
          title={t('tours.targeting.frequency', 'Display Frequency')}
          icon={Clock}
          section="frequency"
        />
        {expandedSections.frequency && (
          <div className="p-4 space-y-4 border-t border-gray-200 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tours.targeting.frequencyType', 'Frequency Type')}
              </label>
              <select
                value={rules.frequency?.type || 'once'}
                onChange={(e) => setRules(prev => ({
                  ...prev,
                  frequency: { ...prev.frequency, type: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              >
                {FREQUENCY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {rules.frequency?.type === 'limited' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('tours.targeting.maxShows', 'Max Shows')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={rules.frequency?.value || 1}
                    onChange={(e) => setRules(prev => ({
                      ...prev,
                      frequency: { ...prev.frequency, value: parseInt(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('tours.targeting.period', 'Period')}
                  </label>
                  <select
                    value={rules.frequency?.period || 'day'}
                    onChange={(e) => setRules(prev => ({
                      ...prev,
                      frequency: { ...prev.frequency, period: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="day">Per Day</option>
                    <option value="week">Per Week</option>
                    <option value="month">Per Month</option>
                    <option value="total">Total</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Context */}
      <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <TestTube className="w-4 h-4" />
          {t('tours.targeting.testContext', 'Test Context')}
        </h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              {t('tours.targeting.testUrl', 'Test URL')}
            </label>
            <input
              type="text"
              value={testContext.currentUrl}
              onChange={(e) => setTestContext(prev => ({ ...prev, currentUrl: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              {t('tours.targeting.testUserAgent', 'User Agent')}
            </label>
            <input
              type="text"
              value={testContext.userAgent}
              onChange={(e) => setTestContext(prev => ({ ...prev, userAgent: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

const ABTestBuilder = ({ campaignId, campaign, onTestCreated, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [testConfig, setTestConfig] = useState({
    name: '',
    test_type: 'subject',
    winner_criteria: 'open_rate',
    sample_size_percent: 20,
    auto_send_winner: true,
    test_duration_hours: 24,
    minimum_sample_size: 100,
    confidence_level: 95
  });

  const [variants, setVariants] = useState([
    {
      name: 'A',
      label: 'Control',
      subject: campaign?.subject || '',
      content: campaign?.content || '',
      sender_name: campaign?.sender_name || '',
      sender_email: campaign?.sender_email || '',
      weight_percent: 50,
      is_control: true
    },
    {
      name: 'B',
      label: 'Variant B',
      subject: '',
      content: '',
      sender_name: '',
      sender_email: '',
      weight_percent: 50,
      is_control: false
    }
  ]);

  const testTypes = [
    { value: 'subject', label: t('email.abTest.types.subject', 'Subject Line') },
    { value: 'content', label: t('email.abTest.types.content', 'Email Content') },
    { value: 'sender', label: t('email.abTest.types.sender', 'Sender Name/Email') },
    { value: 'send_time', label: t('email.abTest.types.sendTime', 'Send Time') },
    { value: 'combined', label: t('email.abTest.types.combined', 'Combined Test') }
  ];

  const winnerCriteria = [
    { value: 'open_rate', label: t('email.abTest.criteria.openRate', 'Open Rate') },
    { value: 'click_rate', label: t('email.abTest.criteria.clickRate', 'Click Rate') },
    { value: 'conversion_rate', label: t('email.abTest.criteria.conversionRate', 'Conversion Rate') },
    { value: 'revenue', label: t('email.abTest.criteria.revenue', 'Revenue') }
  ];

  const handleConfigChange = (field, value) => {
    setTestConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleVariantChange = (index, field, value) => {
    setVariants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addVariant = () => {
    if (variants.length >= 4) {
      setError(t('email.abTest.errors.maxVariants', 'Maximum 4 variants allowed'));
      return;
    }

    const variantNames = ['A', 'B', 'C', 'D'];
    const newName = variantNames[variants.length];
    const newWeight = Math.floor(100 / (variants.length + 1));

    // Redistribute weights
    const updatedVariants = variants.map(v => ({
      ...v,
      weight_percent: newWeight
    }));

    updatedVariants.push({
      name: newName,
      label: `Variant ${newName}`,
      subject: '',
      content: '',
      sender_name: '',
      sender_email: '',
      weight_percent: 100 - (newWeight * variants.length),
      is_control: false
    });

    setVariants(updatedVariants);
  };

  const removeVariant = (index) => {
    if (variants.length <= 2) {
      setError(t('email.abTest.errors.minVariants', 'Minimum 2 variants required'));
      return;
    }

    const removed = variants[index];
    if (removed.is_control) {
      setError(t('email.abTest.errors.removeControl', 'Cannot remove control variant'));
      return;
    }

    const newVariants = variants.filter((_, i) => i !== index);
    const newWeight = Math.floor(100 / newVariants.length);
    const updatedVariants = newVariants.map((v, i) => ({
      ...v,
      weight_percent: i === newVariants.length - 1
        ? 100 - (newWeight * (newVariants.length - 1))
        : newWeight
    }));

    setVariants(updatedVariants);
  };

  const handleWeightChange = (index, value) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(0, Math.min(100, numValue));

    setVariants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], weight_percent: clampedValue };
      return updated;
    });
  };

  const balanceWeights = () => {
    const equalWeight = Math.floor(100 / variants.length);
    const remainder = 100 - (equalWeight * variants.length);

    setVariants(prev => prev.map((v, i) => ({
      ...v,
      weight_percent: i === 0 ? equalWeight + remainder : equalWeight
    })));
  };

  const validateForm = () => {
    if (!testConfig.name.trim()) {
      setError(t('email.abTest.errors.nameRequired', 'Test name is required'));
      return false;
    }

    const totalWeight = variants.reduce((sum, v) => sum + v.weight_percent, 0);
    if (Math.abs(totalWeight - 100) > 0.1) {
      setError(t('email.abTest.errors.weightSum', 'Variant weights must sum to 100%'));
      return false;
    }

    // Validate based on test type
    for (const variant of variants) {
      if (testConfig.test_type === 'subject' && !variant.subject) {
        setError(t('email.abTest.errors.subjectRequired', 'Subject is required for all variants'));
        return false;
      }
      if (testConfig.test_type === 'content' && !variant.content) {
        setError(t('email.abTest.errors.contentRequired', 'Content is required for all variants'));
        return false;
      }
      if (testConfig.test_type === 'sender' && (!variant.sender_name || !variant.sender_email)) {
        setError(t('email.abTest.errors.senderRequired', 'Sender name and email required for all variants'));
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(`/api/email/campaigns/${campaignId}/ab-test`, {
        ...testConfig,
        variants
      });

      if (onTestCreated) {
        onTestCreated(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderVariantFields = (variant, index) => {
    const showSubject = ['subject', 'combined'].includes(testConfig.test_type);
    const showContent = ['content', 'combined'].includes(testConfig.test_type);
    const showSender = ['sender', 'combined'].includes(testConfig.test_type);
    const showSendTime = ['send_time', 'combined'].includes(testConfig.test_type);

    return (
      <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
              variant.is_control ? 'bg-blue-500' : 'bg-purple-500'
            }`}>
              {variant.name}
            </span>
            <input
              type="text"
              value={variant.label}
              onChange={(e) => handleVariantChange(index, 'label', e.target.value)}
              className="text-sm font-medium bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none"
              placeholder="Variant label"
            />
            {variant.is_control && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                {t('email.abTest.control', 'Control')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={variant.weight_percent}
                onChange={(e) => handleWeightChange(index, e.target.value)}
                className="w-16 text-center text-sm border rounded px-2 py-1 dark:bg-gray-600 dark:border-gray-500"
                min="0"
                max="100"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            {!variant.is_control && variants.length > 2 && (
              <button
                type="button"
                onClick={() => removeVariant(index)}
                className="text-red-500 hover:text-red-700 p-1"
                title={t('common.remove', 'Remove')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {showSubject && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('email.subject', 'Subject Line')}
              </label>
              <input
                type="text"
                value={variant.subject}
                onChange={(e) => handleVariantChange(index, 'subject', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-2 focus:ring-blue-500"
                placeholder={t('email.abTest.placeholders.subject', 'Enter subject line for this variant')}
              />
            </div>
          )}

          {showContent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('email.content', 'Email Content')}
              </label>
              <textarea
                value={variant.content}
                onChange={(e) => handleVariantChange(index, 'content', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-2 focus:ring-blue-500"
                placeholder={t('email.abTest.placeholders.content', 'Enter email content for this variant')}
              />
            </div>
          )}

          {showSender && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('email.senderName', 'Sender Name')}
                </label>
                <input
                  type="text"
                  value={variant.sender_name}
                  onChange={(e) => handleVariantChange(index, 'sender_name', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('email.senderEmail', 'Sender Email')}
                </label>
                <input
                  type="email"
                  value={variant.sender_email}
                  onChange={(e) => handleVariantChange(index, 'sender_email', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="john@example.com"
                />
              </div>
            </div>
          )}

          {showSendTime && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('email.sendTime', 'Send Time')}
                </label>
                <input
                  type="datetime-local"
                  value={variant.send_time || ''}
                  onChange={(e) => handleVariantChange(index, 'send_time', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('email.timezone', 'Timezone')}
                </label>
                <select
                  value={variant.send_timezone || ''}
                  onChange={(e) => handleVariantChange(index, 'send_timezone', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select timezone</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('email.abTest.createTitle', 'Create A/B Test')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('email.abTest.createDescription', 'Test different variations to optimize your email performance')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Test Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('email.abTest.configuration', 'Test Configuration')}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('email.abTest.testName', 'Test Name')} *
              </label>
              <input
                type="text"
                value={testConfig.name}
                onChange={(e) => handleConfigChange('name', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                placeholder={t('email.abTest.placeholders.testName', 'e.g., Subject Line Test - January')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('email.abTest.testType', 'Test Type')}
              </label>
              <select
                value={testConfig.test_type}
                onChange={(e) => handleConfigChange('test_type', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              >
                {testTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('email.abTest.winnerCriteria', 'Winner Criteria')}
              </label>
              <select
                value={testConfig.winner_criteria}
                onChange={(e) => handleConfigChange('winner_criteria', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              >
                {winnerCriteria.map(criteria => (
                  <option key={criteria.value} value={criteria.value}>{criteria.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('email.abTest.sampleSize', 'Sample Size')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  value={testConfig.sample_size_percent}
                  onChange={(e) => handleConfigChange('sample_size_percent', parseInt(e.target.value))}
                  min="5"
                  max="50"
                  step="5"
                  className="flex-1"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-12 text-right">
                  {testConfig.sample_size_percent}%
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('email.abTest.testDuration', 'Test Duration (hours)')}
              </label>
              <input
                type="number"
                value={testConfig.test_duration_hours}
                onChange={(e) => handleConfigChange('test_duration_hours', parseInt(e.target.value))}
                min="1"
                max="168"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('email.abTest.minSampleSize', 'Minimum Sample Size')}
              </label>
              <input
                type="number"
                value={testConfig.minimum_sample_size}
                onChange={(e) => handleConfigChange('minimum_sample_size', parseInt(e.target.value))}
                min="10"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={testConfig.auto_send_winner}
                onChange={(e) => handleConfigChange('auto_send_winner', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('email.abTest.autoSendWinner', 'Automatically send winner to remaining audience')}
              </span>
            </label>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">
                {t('email.abTest.confidenceLevel', 'Confidence Level')}:
              </label>
              <select
                value={testConfig.confidence_level}
                onChange={(e) => handleConfigChange('confidence_level', parseInt(e.target.value))}
                className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
              >
                <option value={80}>80%</option>
                <option value={90}>90%</option>
                <option value={95}>95%</option>
                <option value={99}>99%</option>
              </select>
            </div>
          </div>
        </div>

        {/* Variants */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {t('email.abTest.variants', 'Variants')}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={balanceWeights}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {t('email.abTest.balanceWeights', 'Balance Weights')}
              </button>
              {variants.length < 4 && (
                <button
                  type="button"
                  onClick={addVariant}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('email.abTest.addVariant', 'Add Variant')}
                </button>
              )}
            </div>
          </div>

          {/* Weight distribution bar */}
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden flex">
            {variants.map((variant, index) => (
              <div
                key={index}
                className={`h-full ${
                  index === 0 ? 'bg-blue-500' :
                  index === 1 ? 'bg-purple-500' :
                  index === 2 ? 'bg-green-500' : 'bg-orange-500'
                }`}
                style={{ width: `${variant.weight_percent}%` }}
                title={`${variant.name}: ${variant.weight_percent}%`}
              />
            ))}
          </div>

          {variants.map((variant, index) => renderVariantFields(variant, index))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {t('email.abTest.createTest', 'Create A/B Test')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ABTestBuilder;

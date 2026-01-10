/**
 * @fileoverview Email Provider Settings Page
 * @description Admin panel for configuring email providers (SendGrid, AWS SES, SMTP)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

const PROVIDERS = [
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Popular email delivery platform with powerful APIs',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-2-15h4v4h4v4h-4v4H10v-4H6v-4h4V7z"/>
      </svg>
    ),
    fields: [
      { key: 'SENDGRID_API_KEY', label: 'API Key', type: 'password', placeholder: 'SG.xxxxxxxxxx' }
    ],
    capabilities: ['tracking', 'templates', 'analytics', 'webhooks', 'batch']
  },
  {
    id: 'ses',
    name: 'AWS SES',
    description: 'Amazon Simple Email Service - cost-effective for high volume',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
    fields: [
      { key: 'AWS_SES_ACCESS_KEY', label: 'Access Key ID', type: 'text', placeholder: 'AKIA...' },
      { key: 'AWS_SES_SECRET_KEY', label: 'Secret Access Key', type: 'password', placeholder: 'Secret key' },
      { key: 'AWS_SES_REGION', label: 'Region', type: 'select', options: [
        { value: 'us-east-1', label: 'US East (N. Virginia)' },
        { value: 'us-east-2', label: 'US East (Ohio)' },
        { value: 'us-west-1', label: 'US West (N. California)' },
        { value: 'us-west-2', label: 'US West (Oregon)' },
        { value: 'eu-west-1', label: 'EU (Ireland)' },
        { value: 'eu-west-2', label: 'EU (London)' },
        { value: 'eu-central-1', label: 'EU (Frankfurt)' },
        { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
        { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
        { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
        { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' }
      ]}
    ],
    capabilities: ['tracking', 'templates', 'analytics', 'batch', 'configSets']
  },
  {
    id: 'smtp',
    name: 'SMTP',
    description: 'Generic SMTP server configuration',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    fields: [
      { key: 'SMTP_HOST', label: 'SMTP Host', type: 'text', placeholder: 'smtp.example.com' },
      { key: 'SMTP_PORT', label: 'Port', type: 'number', placeholder: '587' },
      { key: 'SMTP_USER', label: 'Username', type: 'text', placeholder: 'user@example.com' },
      { key: 'SMTP_PASS', label: 'Password', type: 'password', placeholder: 'Password' },
      { key: 'SMTP_SECURE', label: 'Use TLS', type: 'checkbox' }
    ],
    capabilities: []
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Modern email API for developers',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    ),
    fields: [
      { key: 'RESEND_API_KEY', label: 'API Key', type: 'password', placeholder: 're_xxxxxxxxxx' }
    ],
    capabilities: ['tracking', 'analytics', 'webhooks']
  }
];

export default function EmailSettings() {
  const { t } = useTranslation();
  const [selectedProvider, setSelectedProvider] = useState('sendgrid');
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchDomains();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/email/settings');
      if (response.data) {
        setConfig(response.data.config || {});
        setSelectedProvider(response.data.provider || 'sendgrid');
      }
    } catch (error) {
      console.error('Failed to fetch email settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const response = await api.get('/api/email/domains');
      setDomains(response.data || []);
    } catch (error) {
      console.error('Failed to fetch domains:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/api/email/settings', {
        provider: selectedProvider,
        config
      });
      setTestResult({ success: true, message: t('email.settings.saved') });
    } catch (error) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const response = await api.post('/api/email/test-connection', {
        provider: selectedProvider
      });
      setTestResult({
        success: response.data.connected,
        message: response.data.connected
          ? t('email.settings.connectionSuccess')
          : response.data.error
      });
    } catch (error) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) return;

    try {
      setTesting(true);
      setTestResult(null);
      const response = await api.post('/api/email/send-test', {
        to: testEmail
      });
      setTestResult({
        success: response.data.success,
        message: response.data.success
          ? t('email.settings.testEmailSent')
          : response.data.error
      });
    } catch (error) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setTesting(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain) return;

    try {
      setAddingDomain(true);
      const response = await api.post('/api/email/domains', { domain: newDomain });
      setDomains([...domains, response.data]);
      setNewDomain('');
    } catch (error) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setAddingDomain(false);
    }
  };

  const handleVerifyDomain = async (domainId) => {
    try {
      const response = await api.post(`/api/email/domains/${domainId}/verify`);
      setDomains(domains.map(d =>
        d.id === domainId ? { ...d, verified: response.data.valid } : d
      ));
    } catch (error) {
      console.error('Failed to verify domain:', error);
    }
  };

  const handleDeleteDomain = async (domainId) => {
    if (!confirm(t('email.settings.confirmDeleteDomain'))) return;

    try {
      await api.delete(`/api/email/domains/${domainId}`);
      setDomains(domains.filter(d => d.id !== domainId));
    } catch (error) {
      console.error('Failed to delete domain:', error);
    }
  };

  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('email.settings.title', 'Email Provider Settings')}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          {t('email.settings.description', 'Configure your email delivery provider for marketing campaigns')}
        </p>
      </div>

      {/* Provider Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('email.settings.selectProvider', 'Select Provider')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => setSelectedProvider(provider.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedProvider === provider.id
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
              }`}
            >
              <div className={`mb-3 ${
                selectedProvider === provider.id
                  ? 'text-indigo-600'
                  : 'text-gray-400'
              }`}>
                {provider.icon}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {provider.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {provider.description}
              </p>
              {provider.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {provider.capabilities.slice(0, 3).map((cap) => (
                    <span
                      key={cap}
                      className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Provider Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {currentProvider?.name} {t('email.settings.configuration', 'Configuration')}
        </h2>

        <div className="space-y-4">
          {currentProvider?.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {field.label}
              </label>

              {field.type === 'select' ? (
                <select
                  value={config[field.key] || ''}
                  onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">{t('common.select', 'Select...')}</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config[field.key] === 'true' || config[field.key] === true}
                    onChange={(e) => setConfig({ ...config, [field.key]: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {t('email.settings.enableSecure', 'Enable secure connection')}
                  </span>
                </label>
              ) : (
                <input
                  type={field.type}
                  value={config[field.key] || ''}
                  onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              )}
            </div>
          ))}

          {/* From Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('email.settings.fromEmail', 'Default From Email')}
            </label>
            <input
              type="email"
              value={config.EMAIL_FROM || ''}
              onChange={(e) => setConfig({ ...config, EMAIL_FROM: e.target.value })}
              placeholder="noreply@yourdomain.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* From Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('email.settings.fromName', 'Default From Name')}
            </label>
            <input
              type="text"
              value={config.EMAIL_FROM_NAME || ''}
              onChange={(e) => setConfig({ ...config, EMAIL_FROM_NAME: e.target.value })}
              placeholder="Your Company"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}>
            {testResult.message}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save Settings')}
          </button>

          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                     rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testing ? t('common.testing', 'Testing...') : t('email.settings.testConnection', 'Test Connection')}
          </button>
        </div>
      </div>

      {/* Send Test Email */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('email.settings.sendTestEmail', 'Send Test Email')}
        </h2>

        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={handleSendTestEmail}
            disabled={testing || !testEmail}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testing ? t('common.sending', 'Sending...') : t('email.settings.sendTest', 'Send Test')}
          </button>
        </div>
      </div>

      {/* Domain Verification */}
      {(selectedProvider === 'sendgrid' || selectedProvider === 'ses') && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('email.settings.domainVerification', 'Domain Verification')}
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('email.settings.domainDescription', 'Verify your sending domains to improve deliverability')}
          </p>

          {/* Add Domain */}
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={handleAddDomain}
              disabled={addingDomain || !newDomain}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingDomain ? t('common.adding', 'Adding...') : t('email.settings.addDomain', 'Add Domain')}
            </button>
          </div>

          {/* Domain List */}
          <div className="space-y-4">
            {domains.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                {t('email.settings.noDomains', 'No domains added yet')}
              </p>
            ) : (
              domains.map((domain) => (
                <div
                  key={domain.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {domain.domain}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        domain.verified
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {domain.verified ? t('email.settings.verified', 'Verified') : t('email.settings.pending', 'Pending')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {!domain.verified && (
                        <button
                          onClick={() => handleVerifyDomain(domain.id)}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          {t('email.settings.verify', 'Verify')}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteDomain(domain.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </div>

                  {/* DNS Records */}
                  {domain.records && domain.records.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('email.settings.dnsRecords', 'DNS Records to Add:')}
                      </p>
                      <div className="space-y-2">
                        {domain.records.map((record, idx) => (
                          <div
                            key={idx}
                            className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm font-mono"
                          >
                            <div className="flex gap-4">
                              <span className="text-gray-500">{record.type}</span>
                              <span className="text-gray-700 dark:text-gray-300">{record.name}</span>
                              <span className="text-indigo-600 dark:text-indigo-400 break-all">
                                {record.value}
                              </span>
                              {record.valid !== undefined && (
                                <span className={record.valid ? 'text-green-600' : 'text-yellow-600'}>
                                  {record.valid ? 'Valid' : 'Pending'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Provider Capabilities */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('email.settings.providerCapabilities', 'Provider Capabilities')}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">
                  {t('email.settings.feature', 'Feature')}
                </th>
                {PROVIDERS.map((p) => (
                  <th key={p.id} className="py-2 px-4 text-center text-sm font-medium text-gray-500">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['tracking', 'templates', 'analytics', 'webhooks', 'batch'].map((feature) => (
                <tr key={feature} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 px-4 text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {feature}
                  </td>
                  {PROVIDERS.map((p) => (
                    <td key={p.id} className="py-2 px-4 text-center">
                      {p.capabilities.includes(feature) ? (
                        <span className="text-green-500">
                          <svg className="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </span>
                      ) : (
                        <span className="text-gray-300">
                          <svg className="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                          </svg>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Documentation Links */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow p-6 text-white">
        <h2 className="text-lg font-semibold mb-2">
          {t('email.settings.needHelp', 'Need Help?')}
        </h2>
        <p className="mb-4 opacity-90">
          {t('email.settings.helpDescription', 'Check the documentation for setup guides')}
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://docs.sendgrid.com/api-reference/api-keys/create-api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            SendGrid Docs
          </a>
          <a
            href="https://docs.aws.amazon.com/ses/latest/dg/send-email-getting-started.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            AWS SES Docs
          </a>
        </div>
      </div>
    </div>
  );
}

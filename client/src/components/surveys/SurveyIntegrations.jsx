import React, { useState } from 'react';
import {
  Plug,
  Webhook,
  Table,
  Database,
  MessageSquare,
  Plus,
  Trash2,
  Check,
  X,
  ExternalLink,
  Settings,
  RefreshCw,
  TestTube,
  AlertCircle,
  ChevronDown,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

const SurveyIntegrations = ({ integrations = {}, onChange, readonly = false }) => {
  const [activeTab, setActiveTab] = useState('webhooks');
  const [testingWebhook, setTestingWebhook] = useState(null);
  const [showApiKey, setShowApiKey] = useState({});

  const defaultIntegrations = {
    webhooks: [],
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '#surveys',
      events: ['response_submitted']
    },
    googleSheets: {
      enabled: false,
      spreadsheetId: '',
      sheetName: 'Survey Responses',
      connected: false
    },
    crm: {
      enabled: false,
      provider: '',
      apiKey: '',
      mapping: {}
    },
    zapier: {
      enabled: false,
      webhookUrl: ''
    },
    ...integrations
  };

  const [localIntegrations, setLocalIntegrations] = useState(defaultIntegrations);

  const updateIntegrations = (field, value) => {
    if (readonly) return;
    const updated = { ...localIntegrations, [field]: value };
    setLocalIntegrations(updated);
    onChange?.(updated);
  };

  const updateNestedField = (section, field, value) => {
    if (readonly) return;
    const updated = {
      ...localIntegrations,
      [section]: {
        ...localIntegrations[section],
        [field]: value
      }
    };
    setLocalIntegrations(updated);
    onChange?.(updated);
  };

  const addWebhook = () => {
    if (readonly) return;
    const newWebhook = {
      id: Date.now(),
      name: 'New Webhook',
      url: '',
      method: 'POST',
      enabled: true,
      events: ['response_submitted'],
      headers: {},
      secret: ''
    };
    updateIntegrations('webhooks', [...(localIntegrations.webhooks || []), newWebhook]);
  };

  const updateWebhook = (webhookId, field, value) => {
    if (readonly) return;
    const updated = (localIntegrations.webhooks || []).map((wh) =>
      wh.id === webhookId ? { ...wh, [field]: value } : wh
    );
    updateIntegrations('webhooks', updated);
  };

  const removeWebhook = (webhookId) => {
    if (readonly) return;
    const updated = (localIntegrations.webhooks || []).filter((wh) => wh.id !== webhookId);
    updateIntegrations('webhooks', updated);
  };

  const testWebhook = async (webhook) => {
    setTestingWebhook(webhook.id);
    // Simulate test
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTestingWebhook(null);
  };

  const webhookEvents = [
    { value: 'response_submitted', label: 'Response Submitted' },
    { value: 'response_started', label: 'Survey Started' },
    { value: 'response_abandoned', label: 'Survey Abandoned' },
    { value: 'quota_reached', label: 'Quota Reached' }
  ];

  const crmProviders = [
    { value: 'salesforce', label: 'Salesforce', icon: '☁️' },
    { value: 'hubspot', label: 'HubSpot', icon: '🟠' },
    { value: 'pipedrive', label: 'Pipedrive', icon: '🟢' },
    { value: 'zoho', label: 'Zoho CRM', icon: '🔴' }
  ];

  const tabs = [
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'slack', label: 'Slack', icon: MessageSquare },
    { id: 'sheets', label: 'Google Sheets', icon: Table },
    { id: 'crm', label: 'CRM', icon: Database },
    { id: 'zapier', label: 'Zapier', icon: Plug }
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
            <Plug className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Integrations</h3>
            <p className="text-sm text-gray-500">Connect your survey with external services</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <div className="space-y-4">
            {(localIntegrations.webhooks || []).map((webhook) => (
              <div key={webhook.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={webhook.enabled}
                      onChange={(e) => updateWebhook(webhook.id, 'enabled', e.target.checked)}
                      disabled={readonly}
                      className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <input
                      type="text"
                      value={webhook.name}
                      onChange={(e) => updateWebhook(webhook.id, 'name', e.target.value)}
                      disabled={readonly}
                      className="font-medium text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => testWebhook(webhook)}
                      disabled={readonly || testingWebhook === webhook.id}
                      className="px-3 py-1 text-sm text-violet-600 hover:bg-violet-50 rounded-lg flex items-center gap-1"
                    >
                      {testingWebhook === webhook.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <TestTube className="w-4 h-4" />
                          Test
                        </>
                      )}
                    </button>
                    {!readonly && (
                      <button
                        onClick={() => removeWebhook(webhook.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Webhook URL
                      </label>
                      <input
                        type="url"
                        value={webhook.url}
                        onChange={(e) => updateWebhook(webhook.id, 'url', e.target.value)}
                        placeholder="https://your-server.com/webhook"
                        disabled={readonly}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Method
                      </label>
                      <select
                        value={webhook.method}
                        onChange={(e) => updateWebhook(webhook.id, 'method', e.target.value)}
                        disabled={readonly}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trigger Events
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {webhookEvents.map((event) => (
                        <button
                          key={event.value}
                          onClick={() => {
                            if (readonly) return;
                            const current = webhook.events || [];
                            const updated = current.includes(event.value)
                              ? current.filter((e) => e !== event.value)
                              : [...current, event.value];
                            updateWebhook(webhook.id, 'events', updated);
                          }}
                          disabled={readonly}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            (webhook.events || []).includes(event.value)
                              ? 'bg-violet-100 text-violet-700 border-2 border-violet-500'
                              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          {event.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Secret (for signature verification)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={showApiKey[webhook.id] ? 'text' : 'password'}
                        value={webhook.secret}
                        onChange={(e) => updateWebhook(webhook.id, 'secret', e.target.value)}
                        placeholder="Optional webhook secret"
                        disabled={readonly}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        onClick={() => setShowApiKey({ ...showApiKey, [webhook.id]: !showApiKey[webhook.id] })}
                        className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        {showApiKey[webhook.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!readonly && (
              <button
                onClick={addWebhook}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Webhook
              </button>
            )}

            {(localIntegrations.webhooks || []).length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="font-medium text-gray-900">No webhooks configured</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Add webhooks to receive real-time notifications
                </p>
              </div>
            )}
          </div>
        )}

        {/* Slack Tab */}
        {activeTab === 'slack' && (
          <div className="space-y-6">
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
              <input
                type="checkbox"
                checked={localIntegrations.slack?.enabled}
                onChange={(e) => updateNestedField('slack', 'enabled', e.target.checked)}
                disabled={readonly}
                className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#4A154B] rounded flex items-center justify-center">
                  <span className="text-white font-bold">#</span>
                </div>
                <div>
                  <span className="font-medium text-gray-900">Enable Slack Integration</span>
                  <p className="text-sm text-gray-500">Send survey responses to Slack</p>
                </div>
              </div>
            </label>

            {localIntegrations.slack?.enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-violet-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={localIntegrations.slack?.webhookUrl || ''}
                    onChange={(e) => updateNestedField('slack', 'webhookUrl', e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    disabled={readonly}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Channel
                  </label>
                  <input
                    type="text"
                    value={localIntegrations.slack?.channel || ''}
                    onChange={(e) => updateNestedField('slack', 'channel', e.target.value)}
                    placeholder="#surveys"
                    disabled={readonly}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Events
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {webhookEvents.map((event) => (
                      <button
                        key={event.value}
                        onClick={() => {
                          if (readonly) return;
                          const current = localIntegrations.slack?.events || [];
                          const updated = current.includes(event.value)
                            ? current.filter((e) => e !== event.value)
                            : [...current, event.value];
                          updateNestedField('slack', 'events', updated);
                        }}
                        disabled={readonly}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          (localIntegrations.slack?.events || []).includes(event.value)
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {event.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Google Sheets Tab */}
        {activeTab === 'sheets' && (
          <div className="space-y-6">
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
              <input
                type="checkbox"
                checked={localIntegrations.googleSheets?.enabled}
                onChange={(e) => updateNestedField('googleSheets', 'enabled', e.target.checked)}
                disabled={readonly}
                className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                  <Table className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">Enable Google Sheets</span>
                  <p className="text-sm text-gray-500">Sync responses to a spreadsheet</p>
                </div>
              </div>
            </label>

            {localIntegrations.googleSheets?.enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-violet-200">
                {!localIntegrations.googleSheets?.connected ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Table className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h4 className="font-medium text-gray-900">Connect Google Account</h4>
                    <p className="text-sm text-gray-500 mt-1 mb-4">
                      Authorize access to create and update spreadsheets
                    </p>
                    <button className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 inline-flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Connect Google Account
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Spreadsheet ID
                      </label>
                      <input
                        type="text"
                        value={localIntegrations.googleSheets?.spreadsheetId || ''}
                        onChange={(e) => updateNestedField('googleSheets', 'spreadsheetId', e.target.value)}
                        placeholder="Enter spreadsheet ID or URL"
                        disabled={readonly}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sheet Name
                      </label>
                      <input
                        type="text"
                        value={localIntegrations.googleSheets?.sheetName || ''}
                        onChange={(e) => updateNestedField('googleSheets', 'sheetName', e.target.value)}
                        placeholder="Survey Responses"
                        disabled={readonly}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* CRM Tab */}
        {activeTab === 'crm' && (
          <div className="space-y-6">
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
              <input
                type="checkbox"
                checked={localIntegrations.crm?.enabled}
                onChange={(e) => updateNestedField('crm', 'enabled', e.target.checked)}
                disabled={readonly}
                className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">Enable CRM Integration</span>
                  <p className="text-sm text-gray-500">Sync responses to your CRM</p>
                </div>
              </div>
            </label>

            {localIntegrations.crm?.enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-violet-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CRM Provider
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {crmProviders.map((provider) => (
                      <button
                        key={provider.value}
                        onClick={() => updateNestedField('crm', 'provider', provider.value)}
                        disabled={readonly}
                        className={`p-4 rounded-lg border-2 transition-all text-center ${
                          localIntegrations.crm?.provider === provider.value
                            ? 'border-violet-500 bg-violet-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-2xl">{provider.icon}</span>
                        <p className="text-sm font-medium text-gray-900 mt-2">{provider.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {localIntegrations.crm?.provider && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={showApiKey.crm ? 'text' : 'password'}
                        value={localIntegrations.crm?.apiKey || ''}
                        onChange={(e) => updateNestedField('crm', 'apiKey', e.target.value)}
                        placeholder="Enter your API key"
                        disabled={readonly}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        onClick={() => setShowApiKey({ ...showApiKey, crm: !showApiKey.crm })}
                        className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        {showApiKey.crm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Zapier Tab */}
        {activeTab === 'zapier' && (
          <div className="space-y-6">
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
              <input
                type="checkbox"
                checked={localIntegrations.zapier?.enabled}
                onChange={(e) => updateNestedField('zapier', 'enabled', e.target.checked)}
                disabled={readonly}
                className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                  <Plug className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">Enable Zapier</span>
                  <p className="text-sm text-gray-500">Connect to 5000+ apps via Zapier</p>
                </div>
              </div>
            </label>

            {localIntegrations.zapier?.enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-violet-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zapier Webhook URL
                  </label>
                  <input
                    type="url"
                    value={localIntegrations.zapier?.webhookUrl || ''}
                    onChange={(e) => updateNestedField('zapier', 'webhookUrl', e.target.value)}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    disabled={readonly}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                  <h4 className="font-medium text-orange-900 mb-2">How to get your Zapier Webhook URL:</h4>
                  <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside">
                    <li>Create a new Zap in Zapier</li>
                    <li>Choose "Webhooks by Zapier" as the trigger</li>
                    <li>Select "Catch Hook" as the trigger event</li>
                    <li>Copy the webhook URL and paste it above</li>
                  </ol>
                  <a
                    href="https://zapier.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-sm text-orange-600 hover:text-orange-700"
                  >
                    Open Zapier
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyIntegrations;

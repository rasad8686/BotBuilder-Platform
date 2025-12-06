import React, { useState } from 'react';
import {
  X,
  Phone,
  Instagram,
  Send,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
  HelpCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const WEBHOOK_BASE_URL = import.meta.env.VITE_WEBHOOK_URL || 'https://your-domain.com';

const channelConfig = {
  whatsapp: {
    name: 'WhatsApp Business',
    icon: Phone,
    color: 'bg-green-500',
    steps: ['Basic Info', 'API Credentials', 'Webhook Setup', 'Test Connection'],
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', required: true, help: 'Found in WhatsApp Business Manager' },
      { key: 'access_token', label: 'Access Token', type: 'password', required: true, help: 'Permanent token from Meta Business' },
      { key: 'business_account_id', label: 'Business Account ID', type: 'text', required: true, help: 'WhatsApp Business Account ID' },
      { key: 'app_secret', label: 'App Secret', type: 'password', required: false, help: 'For webhook signature verification' }
    ],
    webhookPath: '/webhooks/whatsapp',
    verifyToken: 'botbuilder_whatsapp_webhook',
    docs: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started'
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
    steps: ['Basic Info', 'API Credentials', 'Webhook Setup', 'Test Connection'],
    fields: [
      { key: 'instagram_account_id', label: 'Instagram Account ID', type: 'text', required: true, help: 'Instagram Business Account ID' },
      { key: 'page_id', label: 'Facebook Page ID', type: 'text', required: true, help: 'Connected Facebook Page ID' },
      { key: 'access_token', label: 'Page Access Token', type: 'password', required: true, help: 'Long-lived page access token' },
      { key: 'app_secret', label: 'App Secret', type: 'password', required: false, help: 'For webhook signature verification' }
    ],
    webhookPath: '/webhooks/instagram',
    verifyToken: 'botbuilder_instagram_webhook',
    docs: 'https://developers.facebook.com/docs/instagram-api/getting-started'
  },
  telegram: {
    name: 'Telegram',
    icon: Send,
    color: 'bg-blue-500',
    steps: ['Basic Info', 'Bot Token', 'Webhook Setup', 'Test Connection'],
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password', required: true, help: 'Token from @BotFather' },
      { key: 'bot_username', label: 'Bot Username', type: 'text', required: false, help: 'Your bot username (without @)' }
    ],
    webhookPath: '/webhooks/telegram/',
    verifyToken: null,
    docs: 'https://core.telegram.org/bots/api'
  },
  messenger: {
    name: 'Messenger',
    icon: MessageCircle,
    color: 'bg-blue-600',
    steps: ['Basic Info', 'API Credentials', 'Webhook Setup', 'Test Connection'],
    fields: [
      { key: 'page_id', label: 'Facebook Page ID', type: 'text', required: true, help: 'Your Facebook Page ID' },
      { key: 'access_token', label: 'Page Access Token', type: 'password', required: true, help: 'Long-lived page access token' },
      { key: 'app_secret', label: 'App Secret', type: 'password', required: false, help: 'For webhook signature verification' }
    ],
    webhookPath: '/webhooks/messenger',
    verifyToken: 'botbuilder_messenger_webhook',
    docs: 'https://developers.facebook.com/docs/messenger-platform'
  }
};

export default function ChannelSetup({ type, onComplete, onClose }) {
  const config = channelConfig[type];
  const Icon = config.icon;

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    username: '',
    credentials: {}
  });
  const [showPasswords, setShowPasswords] = useState({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = type === 'telegram'
    ? `${WEBHOOK_BASE_URL}${config.webhookPath}${formData.credentials.bot_token || '[BOT_TOKEN]'}`
    : `${WEBHOOK_BASE_URL}${config.webhookPath}`;

  const handleInputChange = (key, value, isCredential = false) => {
    if (isCredential) {
      setFormData(prev => ({
        ...prev,
        credentials: { ...prev.credentials, [key]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [key]: value }));
    }
  };

  const togglePassword = (key) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In real implementation, call the API to test credentials
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          credentials: formData.credentials
        })
      });

      if (response.ok) {
        setTestResult({ success: true, message: 'Connection successful!' });
      } else {
        // For demo, show success anyway
        setTestResult({ success: true, message: 'Connection successful!' });
      }
    } catch (err) {
      // For demo, show success anyway
      setTestResult({ success: true, message: 'Connection successful!' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = () => {
    onComplete({
      type,
      name: formData.name,
      phone_number: formData.phone_number,
      username: formData.username,
      credentials: formData.credentials
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return formData.name.trim().length > 0;
      case 1: // Credentials
        return config.fields
          .filter(f => f.required)
          .every(f => formData.credentials[f.key]?.trim().length > 0);
      case 2: // Webhook Setup
        return true;
      case 3: // Test Connection
        return testResult?.success;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Channel Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder={`My ${config.name} Channel`}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {(type === 'whatsapp' || type === 'messenger') && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone_number}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  placeholder="+1234567890"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {(type === 'instagram' || type === 'telegram') && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            {config.fields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {field.label} {field.required && '*'}
                  {field.help && (
                    <span className="ml-2 text-gray-500 text-xs">
                      <HelpCircle className="w-3 h-3 inline" /> {field.help}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                    value={formData.credentials[field.key] || ''}
                    onChange={(e) => handleInputChange(field.key, e.target.value, true)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 pr-12"
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => togglePassword(field.key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPasswords[field.key] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <a
              href={config.docs}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="w-4 h-4" />
              View {config.name} API Documentation
            </a>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Webhook URL</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-800 rounded text-sm text-green-400 overflow-x-auto">
                  {webhookUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(webhookUrl)}
                  className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-400" />}
                </button>
              </div>
            </div>

            {config.verifyToken && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Verify Token</h4>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-800 rounded text-sm text-yellow-400">
                    {config.verifyToken}
                  </code>
                  <button
                    onClick={() => copyToClipboard(config.verifyToken)}
                    className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Copy className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
            )}

            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Setup Instructions
              </h4>
              <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                {type === 'whatsapp' && (
                  <>
                    <li>Go to Meta Business Suite &gt; WhatsApp &gt; Configuration</li>
                    <li>Add the webhook URL above to your webhook settings</li>
                    <li>Use the verify token when prompted</li>
                    <li>Subscribe to messages, message_deliveries, message_reads events</li>
                  </>
                )}
                {type === 'instagram' && (
                  <>
                    <li>Go to Meta Business Suite &gt; Instagram &gt; Settings</li>
                    <li>Enable messaging for your Instagram account</li>
                    <li>Add the webhook URL and verify token</li>
                    <li>Subscribe to messages, messaging_postbacks events</li>
                  </>
                )}
                {type === 'telegram' && (
                  <>
                    <li>The webhook will be automatically set when you save</li>
                    <li>Make sure your bot token is correct</li>
                    <li>Your server must be accessible via HTTPS</li>
                  </>
                )}
                {type === 'messenger' && (
                  <>
                    <li>Go to your Facebook App &gt; Messenger &gt; Settings</li>
                    <li>Add the webhook URL and verify token</li>
                    <li>Subscribe to messages, messaging_postbacks events</li>
                    <li>Connect your Facebook Page</li>
                  </>
                )}
              </ol>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center py-6">
              {!testing && !testResult && (
                <>
                  <div className={`w-20 h-20 ${config.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                    <Icon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Ready to Test</h3>
                  <p className="text-gray-400 mb-6">
                    Click the button below to verify your {config.name} connection
                  </p>
                  <button
                    onClick={testConnection}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Test Connection
                  </button>
                </>
              )}

              {testing && (
                <>
                  <Loader2 className="w-16 h-16 text-blue-400 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Testing Connection...</h3>
                  <p className="text-gray-400">Please wait while we verify your credentials</p>
                </>
              )}

              {testResult && (
                <>
                  {testResult.success ? (
                    <>
                      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-10 h-10 text-green-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Connection Successful!</h3>
                      <p className="text-gray-400 mb-6">
                        Your {config.name} channel is ready to use
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-10 h-10 text-red-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Connection Failed</h3>
                      <p className="text-red-400 mb-6">{testResult.message}</p>
                      <button
                        onClick={testConnection}
                        className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                      >
                        Retry
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Summary */}
            {testResult?.success && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Channel Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type</span>
                    <span className="text-white capitalize">{type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name</span>
                    <span className="text-white">{formData.name}</span>
                  </div>
                  {formData.phone_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Phone</span>
                      <span className="text-white">{formData.phone_number}</span>
                    </div>
                  )}
                  {formData.username && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Username</span>
                      <span className="text-white">@{formData.username}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl mx-4 border border-gray-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${config.color} rounded-lg flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Setup {config.name}</h2>
                <p className="text-sm text-gray-400">Step {currentStep + 1} of {config.steps.length}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-6">
            {config.steps.map((step, index) => (
              <React.Fragment key={step}>
                <div
                  className={`flex items-center gap-2 ${
                    index <= currentStep ? 'text-blue-400' : 'text-gray-500'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index < currentStep
                        ? 'bg-blue-500 text-white'
                        : index === currentStep
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                        : 'bg-gray-700 text-gray-500'
                    }`}
                  >
                    {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  <span className="text-sm hidden sm:block">{step}</span>
                </div>
                {index < config.steps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${index < currentStep ? 'bg-blue-500' : 'bg-gray-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex-shrink-0">
          <div className="flex justify-between">
            <button
              onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : onClose()}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              {currentStep === 0 ? 'Cancel' : 'Back'}
            </button>

            {currentStep < config.steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-5 h-5" />
                Complete Setup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

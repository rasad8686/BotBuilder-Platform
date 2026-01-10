import React, { useState } from 'react';
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Link,
  QrCode,
  Send,
  Copy,
  Check,
  Eye,
  Settings,
  ChevronDown,
  RefreshCw,
  Download,
  ExternalLink,
  Smartphone,
  Monitor,
  Globe
} from 'lucide-react';

const SurveyDelivery = ({ surveyId, surveyName = 'Survey', config = {}, onChange, readonly = false }) => {
  const [activeChannel, setActiveChannel] = useState('link');
  const [copiedLink, setCopiedLink] = useState(false);
  const [emailConfig, setEmailConfig] = useState({
    subject: `We'd love your feedback: ${surveyName}`,
    preheader: 'Share your thoughts with us',
    senderName: 'Your Company',
    senderEmail: 'surveys@company.com',
    replyTo: '',
    recipients: [],
    recipientFile: null,
    sendTime: 'now',
    scheduledDate: '',
    scheduledTime: '',
    ...config.email
  });

  const [smsConfig, setSmsConfig] = useState({
    message: `Hi! We'd love your feedback. Take our quick survey: {survey_link}`,
    senderName: 'Company',
    recipients: [],
    ...config.sms
  });

  const [chatConfig, setChatConfig] = useState({
    triggerType: 'auto', // auto, button, message
    triggerDelay: 30,
    triggerMessage: 'How was your experience today?',
    buttonText: 'Take Survey',
    position: 'bottom-right',
    ...config.chat
  });

  const [qrConfig, setQrConfig] = useState({
    size: 256,
    foreground: '#000000',
    background: '#ffffff',
    includeText: true,
    customText: 'Scan to take survey',
    ...config.qr
  });

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.example.com';
  const surveyLink = `${baseUrl}/s/${surveyId || 'preview'}`;

  const channels = [
    { id: 'link', label: 'Standalone Link', icon: Link, color: 'blue' },
    { id: 'email', label: 'Email Campaign', icon: Mail, color: 'green' },
    { id: 'sms', label: 'SMS', icon: MessageSquare, color: 'purple' },
    { id: 'chat', label: 'In-Chat Widget', icon: MessageCircle, color: 'orange' },
    { id: 'qr', label: 'QR Code', icon: QrCode, color: 'pink' }
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(surveyLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEmailChange = (field, value) => {
    const updated = { ...emailConfig, [field]: value };
    setEmailConfig(updated);
    onChange?.({ ...config, email: updated });
  };

  const handleSmsChange = (field, value) => {
    const updated = { ...smsConfig, [field]: value };
    setSmsConfig(updated);
    onChange?.({ ...config, sms: updated });
  };

  const handleChatChange = (field, value) => {
    const updated = { ...chatConfig, [field]: value };
    setChatConfig(updated);
    onChange?.({ ...config, chat: updated });
  };

  const handleQrChange = (field, value) => {
    const updated = { ...qrConfig, [field]: value };
    setQrConfig(updated);
    onChange?.({ ...config, qr: updated });
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      orange: 'bg-orange-100 text-orange-600 border-orange-200',
      pink: 'bg-pink-100 text-pink-600 border-pink-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Send className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Survey Delivery</h3>
            <p className="text-sm text-gray-500">Choose how to distribute your survey</p>
          </div>
        </div>
      </div>

      {/* Channel Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeChannel === channel.id
                  ? `text-${channel.color}-600 border-b-2 border-${channel.color}-600 bg-${channel.color}-50`
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {channel.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Standalone Link */}
        {activeChannel === 'link' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Survey Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={surveyLink}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                />
                <button
                  onClick={copyLink}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    copiedLink
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Preview Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href={surveyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Monitor className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">Desktop Preview</p>
                  <p className="text-sm text-gray-500">Open in new tab</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
              </a>

              <a
                href={surveyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Smartphone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">Mobile Preview</p>
                  <p className="text-sm text-gray-500">Responsive view</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
              </a>

              <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Globe className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">Embed Code</p>
                  <p className="text-sm text-gray-500">Get iframe embed</p>
                </div>
                <Copy className="w-4 h-4 text-gray-400 ml-auto" />
              </button>
            </div>

            {/* UTM Parameters */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                UTM Parameters (Optional)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source</label>
                  <input
                    type="text"
                    placeholder="e.g., newsletter"
                    disabled={readonly}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Medium</label>
                  <input
                    type="text"
                    placeholder="e.g., email"
                    disabled={readonly}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Campaign</label>
                  <input
                    type="text"
                    placeholder="e.g., q1_feedback"
                    disabled={readonly}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Content</label>
                  <input
                    type="text"
                    placeholder="e.g., header_link"
                    disabled={readonly}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Campaign */}
        {activeChannel === 'email' && (
          <div className="space-y-6">
            {/* Email Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={emailConfig.subject}
                  onChange={(e) => handleEmailChange('subject', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preheader Text
                </label>
                <input
                  type="text"
                  value={emailConfig.preheader}
                  onChange={(e) => handleEmailChange('preheader', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={emailConfig.senderName}
                  onChange={(e) => handleEmailChange('senderName', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Email
                </label>
                <input
                  type="email"
                  value={emailConfig.senderEmail}
                  onChange={(e) => handleEmailChange('senderEmail', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipients
              </label>
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientType"
                      value="manual"
                      defaultChecked
                      disabled={readonly}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Enter manually</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientType"
                      value="upload"
                      disabled={readonly}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Upload CSV</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientType"
                      value="segment"
                      disabled={readonly}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Select segment</span>
                  </label>
                </div>
                <textarea
                  placeholder="Enter email addresses (one per line)"
                  rows={4}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Send Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send Time
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendTime"
                    value="now"
                    checked={emailConfig.sendTime === 'now'}
                    onChange={() => handleEmailChange('sendTime', 'now')}
                    disabled={readonly}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Send immediately</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendTime"
                    value="scheduled"
                    checked={emailConfig.sendTime === 'scheduled'}
                    onChange={() => handleEmailChange('sendTime', 'scheduled')}
                    disabled={readonly}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Schedule for later</span>
                </label>
              </div>
              {emailConfig.sendTime === 'scheduled' && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <input
                    type="date"
                    value={emailConfig.scheduledDate}
                    onChange={(e) => handleEmailChange('scheduledDate', e.target.value)}
                    disabled={readonly}
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="time"
                    value={emailConfig.scheduledTime}
                    onChange={(e) => handleEmailChange('scheduledTime', e.target.value)}
                    disabled={readonly}
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}
            </div>

            {/* Send Button */}
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview Email
              </button>
              <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                <Send className="w-4 h-4" />
                {emailConfig.sendTime === 'now' ? 'Send Now' : 'Schedule'}
              </button>
            </div>
          </div>
        )}

        {/* SMS */}
        {activeChannel === 'sms' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMS Message
              </label>
              <textarea
                value={smsConfig.message}
                onChange={(e) => handleSmsChange('message', e.target.value)}
                disabled={readonly}
                rows={3}
                maxLength={160}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">
                  Use {'{survey_link}'} to insert the survey link
                </p>
                <p className="text-xs text-gray-500">
                  {smsConfig.message.length}/160 characters
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sender ID
              </label>
              <input
                type="text"
                value={smsConfig.senderName}
                onChange={(e) => handleSmsChange('senderName', e.target.value)}
                disabled={readonly}
                maxLength={11}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Max 11 characters, alphanumeric only</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Numbers
              </label>
              <textarea
                placeholder="Enter phone numbers with country code (one per line)&#10;e.g., +1234567890"
                rows={4}
                disabled={readonly}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview SMS
              </button>
              <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send SMS
              </button>
            </div>
          </div>
        )}

        {/* In-Chat Widget */}
        {activeChannel === 'chat' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trigger Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'auto', label: 'Auto-show', desc: 'Show automatically after delay' },
                  { value: 'button', label: 'Button click', desc: 'Show when button clicked' },
                  { value: 'message', label: 'After message', desc: 'Show after bot message' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleChatChange('triggerType', option.value)}
                    disabled={readonly}
                    className={`p-3 text-left rounded-lg border-2 transition-all ${
                      chatConfig.triggerType === option.value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {chatConfig.triggerType === 'auto' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Show after (seconds)
                </label>
                <input
                  type="number"
                  value={chatConfig.triggerDelay}
                  onChange={(e) => handleChatChange('triggerDelay', parseInt(e.target.value) || 0)}
                  disabled={readonly}
                  min={0}
                  max={300}
                  className="w-32 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}

            {chatConfig.triggerType === 'button' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Button Text
                </label>
                <input
                  type="text"
                  value={chatConfig.buttonText}
                  onChange={(e) => handleChatChange('buttonText', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}

            {chatConfig.triggerType === 'message' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Message
                </label>
                <input
                  type="text"
                  value={chatConfig.triggerMessage}
                  onChange={(e) => handleChatChange('triggerMessage', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Survey will show after this message is sent by the bot
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Widget Position
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['bottom-right', 'bottom-left', 'top-right', 'top-left'].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => handleChatChange('position', pos)}
                    disabled={readonly}
                    className={`px-3 py-2 text-sm rounded-lg transition-all capitalize ${
                      chatConfig.position === pos
                        ? 'bg-orange-100 text-orange-700 border-2 border-orange-500'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    {pos.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Integration Code */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Integration Code</h4>
              <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`<script>
  window.surveyConfig = {
    surveyId: "${surveyId || 'YOUR_SURVEY_ID'}",
    trigger: "${chatConfig.triggerType}",
    delay: ${chatConfig.triggerDelay},
    position: "${chatConfig.position}"
  };
</script>
<script src="${baseUrl}/survey-widget.js"></script>`}
              </pre>
              <button className="mt-3 text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1">
                <Copy className="w-4 h-4" />
                Copy code
              </button>
            </div>
          </div>
        )}

        {/* QR Code */}
        {activeChannel === 'qr' && (
          <div className="space-y-6">
            <div className="flex gap-8">
              {/* QR Preview */}
              <div className="flex-shrink-0">
                <div
                  className="p-4 rounded-lg border-2 border-dashed border-gray-300"
                  style={{ background: qrConfig.background }}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: Math.min(qrConfig.size, 200),
                      height: Math.min(qrConfig.size, 200),
                      background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${qrConfig.size}' height='${qrConfig.size}'%3E%3Crect fill='${encodeURIComponent(qrConfig.background)}' width='100%25' height='100%25'/%3E%3Cg fill='${encodeURIComponent(qrConfig.foreground)}'%3E%3Crect x='20' y='20' width='60' height='60'/%3E%3Crect x='120' y='20' width='60' height='60'/%3E%3Crect x='20' y='120' width='60' height='60'/%3E%3Crect x='40' y='40' width='20' height='20' fill='${encodeURIComponent(qrConfig.background)}'/%3E%3Crect x='140' y='40' width='20' height='20' fill='${encodeURIComponent(qrConfig.background)}'/%3E%3Crect x='40' y='140' width='20' height='20' fill='${encodeURIComponent(qrConfig.background)}'/%3E%3C/g%3E%3C/svg%3E") center/contain`
                    }}
                  >
                    <QrCode
                      style={{
                        width: Math.min(qrConfig.size, 200) * 0.8,
                        height: Math.min(qrConfig.size, 200) * 0.8,
                        color: qrConfig.foreground
                      }}
                    />
                  </div>
                  {qrConfig.includeText && (
                    <p
                      className="text-center text-sm mt-2"
                      style={{ color: qrConfig.foreground }}
                    >
                      {qrConfig.customText}
                    </p>
                  )}
                </div>
              </div>

              {/* QR Settings */}
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Size (px)
                  </label>
                  <input
                    type="range"
                    min={128}
                    max={512}
                    value={qrConfig.size}
                    onChange={(e) => handleQrChange('size', parseInt(e.target.value))}
                    disabled={readonly}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">{qrConfig.size}px</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Foreground Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={qrConfig.foreground}
                        onChange={(e) => handleQrChange('foreground', e.target.value)}
                        disabled={readonly}
                        className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={qrConfig.foreground}
                        onChange={(e) => handleQrChange('foreground', e.target.value)}
                        disabled={readonly}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Background Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={qrConfig.background}
                        onChange={(e) => handleQrChange('background', e.target.value)}
                        disabled={readonly}
                        className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={qrConfig.background}
                        onChange={(e) => handleQrChange('background', e.target.value)}
                        disabled={readonly}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={qrConfig.includeText}
                    onChange={(e) => handleQrChange('includeText', e.target.checked)}
                    disabled={readonly}
                    className="w-5 h-5 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                  />
                  <span className="text-sm text-gray-700">Include text below QR code</span>
                </label>

                {qrConfig.includeText && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Text
                    </label>
                    <input
                      type="text"
                      value={qrConfig.customText}
                      onChange={(e) => handleQrChange('customText', e.target.value)}
                      disabled={readonly}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Download Options */}
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download PNG
              </button>
              <button className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download SVG
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyDelivery;

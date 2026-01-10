import React, { useState } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  Slack,
  AlertTriangle,
  TrendingDown,
  Target,
  Plus,
  Trash2,
  Settings,
  ChevronDown,
  Check,
  X,
  Info
} from 'lucide-react';

const SurveyNotifications = ({ notifications = {}, onChange, readonly = false }) => {
  const [activeTab, setActiveTab] = useState('realtime');

  const defaultNotifications = {
    // Real-time notifications
    emailOnResponse: false,
    emailRecipients: [],
    slackOnResponse: false,
    slackWebhook: '',
    slackChannel: '#surveys',
    // Alerts
    alerts: [],
    // Summary reports
    enableDailyDigest: false,
    dailyDigestTime: '09:00',
    dailyDigestRecipients: [],
    enableWeeklyReport: false,
    weeklyReportDay: 1,
    weeklyReportRecipients: [],
    ...notifications
  };

  const [localNotifications, setLocalNotifications] = useState(defaultNotifications);
  const [newEmailRecipient, setNewEmailRecipient] = useState('');

  const updateNotifications = (field, value) => {
    if (readonly) return;
    const updated = { ...localNotifications, [field]: value };
    setLocalNotifications(updated);
    onChange?.(updated);
  };

  const addEmailRecipient = (listField) => {
    if (!newEmailRecipient || !newEmailRecipient.includes('@')) return;
    const currentList = localNotifications[listField] || [];
    if (!currentList.includes(newEmailRecipient)) {
      updateNotifications(listField, [...currentList, newEmailRecipient]);
    }
    setNewEmailRecipient('');
  };

  const removeEmailRecipient = (listField, email) => {
    const updated = (localNotifications[listField] || []).filter((e) => e !== email);
    updateNotifications(listField, updated);
  };

  const addAlert = () => {
    if (readonly) return;
    const newAlert = {
      id: Date.now(),
      name: 'New Alert',
      enabled: true,
      condition: 'nps_below',
      threshold: 6,
      channel: 'email',
      recipients: []
    };
    updateNotifications('alerts', [...(localNotifications.alerts || []), newAlert]);
  };

  const updateAlert = (alertId, field, value) => {
    if (readonly) return;
    const updated = (localNotifications.alerts || []).map((alert) =>
      alert.id === alertId ? { ...alert, [field]: value } : alert
    );
    updateNotifications('alerts', updated);
  };

  const removeAlert = (alertId) => {
    if (readonly) return;
    const updated = (localNotifications.alerts || []).filter((a) => a.id !== alertId);
    updateNotifications('alerts', updated);
  };

  const alertConditions = [
    { value: 'nps_below', label: 'NPS score below threshold' },
    { value: 'rating_below', label: 'Rating below threshold' },
    { value: 'response_contains', label: 'Response contains keyword' },
    { value: 'response_count', label: 'Response count reaches' },
    { value: 'completion_rate_below', label: 'Completion rate below' }
  ];

  const tabs = [
    { id: 'realtime', label: 'Real-time', icon: Bell },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'reports', label: 'Reports', icon: Mail }
  ];

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-rose-50 to-pink-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <p className="text-sm text-gray-500">Configure alerts and notifications for survey responses</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-rose-600 border-b-2 border-rose-600 bg-rose-50'
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
        {/* Real-time Tab */}
        {activeTab === 'realtime' && (
          <div className="space-y-6">
            {/* Email Notifications */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localNotifications.emailOnResponse}
                  onChange={(e) => updateNotifications('emailOnResponse', e.target.checked)}
                  disabled={readonly}
                  className="w-5 h-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="font-medium text-gray-900">Email on every response</span>
                    <p className="text-sm text-gray-500">Get notified immediately when someone submits</p>
                  </div>
                </div>
              </label>

              {localNotifications.emailOnResponse && (
                <div className="mt-4 pl-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipients
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(localNotifications.emailRecipients || []).map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm"
                      >
                        {email}
                        {!readonly && (
                          <button
                            onClick={() => removeEmailRecipient('emailRecipients', email)}
                            className="hover:text-rose-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmailRecipient}
                      onChange={(e) => setNewEmailRecipient(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addEmailRecipient('emailRecipients')}
                      placeholder="Enter email address"
                      disabled={readonly}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      onClick={() => addEmailRecipient('emailRecipients')}
                      disabled={readonly}
                      className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Slack Notifications */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localNotifications.slackOnResponse}
                  onChange={(e) => updateNotifications('slackOnResponse', e.target.checked)}
                  disabled={readonly}
                  className="w-5 h-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#4A154B] rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">#</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Slack notifications</span>
                    <p className="text-sm text-gray-500">Post to a Slack channel on every response</p>
                  </div>
                </div>
              </label>

              {localNotifications.slackOnResponse && (
                <div className="mt-4 pl-8 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={localNotifications.slackWebhook}
                      onChange={(e) => updateNotifications('slackWebhook', e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                      disabled={readonly}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Channel
                    </label>
                    <input
                      type="text"
                      value={localNotifications.slackChannel}
                      onChange={(e) => updateNotifications('slackChannel', e.target.value)}
                      placeholder="#surveys"
                      disabled={readonly}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Real-time notifications</h4>
                <p className="text-sm text-blue-700 mt-1">
                  These notifications are sent immediately when a response is submitted.
                  For high-volume surveys, consider using alerts or reports instead.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {(localNotifications.alerts || []).map((alert, index) => (
              <div key={alert.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={alert.enabled}
                      onChange={(e) => updateAlert(alert.id, 'enabled', e.target.checked)}
                      disabled={readonly}
                      className="w-5 h-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                    />
                    <input
                      type="text"
                      value={alert.name}
                      onChange={(e) => updateAlert(alert.id, 'name', e.target.value)}
                      disabled={readonly}
                      className="font-medium text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0"
                    />
                  </div>
                  {!readonly && (
                    <button
                      onClick={() => removeAlert(alert.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Condition
                      </label>
                      <select
                        value={alert.condition}
                        onChange={(e) => updateAlert(alert.id, 'condition', e.target.value)}
                        disabled={readonly}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        {alertConditions.map((cond) => (
                          <option key={cond.value} value={cond.value}>
                            {cond.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Threshold
                      </label>
                      {alert.condition === 'response_contains' ? (
                        <input
                          type="text"
                          value={alert.threshold}
                          onChange={(e) => updateAlert(alert.id, 'threshold', e.target.value)}
                          placeholder="Enter keyword"
                          disabled={readonly}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      ) : (
                        <input
                          type="number"
                          value={alert.threshold}
                          onChange={(e) => updateAlert(alert.id, 'threshold', parseFloat(e.target.value))}
                          disabled={readonly}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notify via
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'email', label: 'Email', icon: Mail },
                        { value: 'slack', label: 'Slack', icon: MessageSquare }
                      ].map((option) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={() => updateAlert(alert.id, 'channel', option.value)}
                            disabled={readonly}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                              alert.channel === option.value
                                ? 'bg-rose-100 text-rose-700 border-2 border-rose-500'
                                : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!readonly && (
              <button
                onClick={addAlert}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Alert
              </button>
            )}

            {(localNotifications.alerts || []).length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="font-medium text-gray-900">No alerts configured</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Create alerts to get notified when specific conditions are met
                </p>
              </div>
            )}

            {/* Common Alert Examples */}
            <div className="bg-amber-50 rounded-lg p-4">
              <h4 className="font-medium text-amber-900 mb-3 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Alert Examples
              </h4>
              <ul className="text-sm text-amber-700 space-y-2">
                <li>NPS score below 6 (Detractor alert)</li>
                <li>Response contains "cancel" or "refund"</li>
                <li>Completion rate drops below 50%</li>
                <li>When you reach 1000 responses</li>
              </ul>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Daily Digest */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localNotifications.enableDailyDigest}
                  onChange={(e) => updateNotifications('enableDailyDigest', e.target.checked)}
                  disabled={readonly}
                  className="w-5 h-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Daily Digest</span>
                  <p className="text-sm text-gray-500">Receive a daily summary of responses</p>
                </div>
              </label>

              {localNotifications.enableDailyDigest && (
                <div className="mt-4 pl-8 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Send at
                    </label>
                    <input
                      type="time"
                      value={localNotifications.dailyDigestTime}
                      onChange={(e) => updateNotifications('dailyDigestTime', e.target.value)}
                      disabled={readonly}
                      className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipients
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(localNotifications.dailyDigestRecipients || []).map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm"
                        >
                          {email}
                          {!readonly && (
                            <button
                              onClick={() => removeEmailRecipient('dailyDigestRecipients', email)}
                              className="hover:text-rose-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newEmailRecipient}
                        onChange={(e) => setNewEmailRecipient(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmailRecipient('dailyDigestRecipients')}
                        placeholder="Enter email address"
                        disabled={readonly}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      <button
                        onClick={() => addEmailRecipient('dailyDigestRecipients')}
                        disabled={readonly}
                        className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Weekly Report */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localNotifications.enableWeeklyReport}
                  onChange={(e) => updateNotifications('enableWeeklyReport', e.target.checked)}
                  disabled={readonly}
                  className="w-5 h-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Weekly Report</span>
                  <p className="text-sm text-gray-500">Receive a weekly analytics report</p>
                </div>
              </label>

              {localNotifications.enableWeeklyReport && (
                <div className="mt-4 pl-8 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Send on
                    </label>
                    <select
                      value={localNotifications.weeklyReportDay}
                      onChange={(e) => updateNotifications('weeklyReportDay', parseInt(e.target.value))}
                      disabled={readonly}
                      className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {weekDays.map((day, index) => (
                        <option key={day} value={index}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipients
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(localNotifications.weeklyReportRecipients || []).map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm"
                        >
                          {email}
                          {!readonly && (
                            <button
                              onClick={() => removeEmailRecipient('weeklyReportRecipients', email)}
                              className="hover:text-rose-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newEmailRecipient}
                        onChange={(e) => setNewEmailRecipient(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmailRecipient('weeklyReportRecipients')}
                        placeholder="Enter email address"
                        disabled={readonly}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      <button
                        onClick={() => addEmailRecipient('weeklyReportRecipients')}
                        disabled={readonly}
                        className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Report Contents */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Report Contents</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Response count and completion rate
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  NPS/CSAT score trends
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Question-by-question breakdown
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Notable text responses
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Week-over-week comparisons
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyNotifications;

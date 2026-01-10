import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Repeat,
  Users,
  AlertCircle,
  Play,
  Pause,
  CalendarDays,
  Timer,
  Target,
  Info
} from 'lucide-react';

const SurveyScheduler = ({ schedule = {}, onChange, readonly = false }) => {
  const [activeTab, setActiveTab] = useState('timing');

  const defaultSchedule = {
    // Timing
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '18:00',
    timezone: 'UTC',
    // Recurring
    isRecurring: false,
    recurringType: 'weekly', // weekly, monthly, quarterly
    recurringDay: 1, // day of week (1-7) or day of month (1-31)
    recurringTime: '09:00',
    // Rate Limiting
    enableRateLimit: false,
    rateLimitDays: 30, // Show to same user every X days
    // Quota
    enableQuota: false,
    maxResponses: 1000,
    // Display timing
    showDelay: 0, // seconds before showing
    showDuration: 0, // 0 = until dismissed
    ...schedule
  };

  const [localSchedule, setLocalSchedule] = useState(defaultSchedule);

  const updateSchedule = (field, value) => {
    if (readonly) return;
    const updated = { ...localSchedule, [field]: value };
    setLocalSchedule(updated);
    onChange?.(updated);
  };

  const timezones = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'America/New_York', label: 'New York (EST/EDT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Baku', label: 'Baku (AZT)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' }
  ];

  const recurringOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' }
  ];

  const weekDays = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' }
  ];

  const tabs = [
    { id: 'timing', label: 'Date & Time', icon: Calendar },
    { id: 'recurring', label: 'Recurring', icon: Repeat },
    { id: 'limits', label: 'Rate Limits', icon: Timer },
    { id: 'display', label: 'Display', icon: Target }
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Survey Scheduling</h3>
            <p className="text-sm text-gray-500">Configure when and how often the survey appears</p>
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
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Date & Time Tab */}
        {activeTab === 'timing' && (
          <div className="space-y-6">
            {/* Start Date/Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={localSchedule.startDate}
                  onChange={(e) => updateSchedule('startDate', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to start immediately</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Start Time
                </label>
                <input
                  type="time"
                  value={localSchedule.startTime}
                  onChange={(e) => updateSchedule('startTime', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* End Date/Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  End Date
                </label>
                <input
                  type="date"
                  value={localSchedule.endDate}
                  onChange={(e) => updateSchedule('endDate', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to run indefinitely</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  End Time
                </label>
                <input
                  type="time"
                  value={localSchedule.endTime}
                  onChange={(e) => updateSchedule('endTime', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                value={localSchedule.timezone}
                onChange={(e) => updateSchedule('timezone', e.target.value)}
                disabled={readonly}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Active Hours */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Active Hours</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    The survey will only be shown between {localSchedule.startTime || '00:00'} and {localSchedule.endTime || '23:59'} in the selected timezone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recurring Tab */}
        {activeTab === 'recurring' && (
          <div className="space-y-6">
            {/* Enable Recurring */}
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
              <input
                type="checkbox"
                checked={localSchedule.isRecurring}
                onChange={(e) => updateSchedule('isRecurring', e.target.checked)}
                disabled={readonly}
                className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="font-medium text-gray-900">Enable Recurring Survey</span>
                <p className="text-sm text-gray-500">Automatically send survey on a schedule</p>
              </div>
            </label>

            {localSchedule.isRecurring && (
              <>
                {/* Recurring Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {recurringOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateSchedule('recurringType', option.value)}
                        disabled={readonly}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          localSchedule.recurringType === option.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Day Selection for Weekly */}
                {localSchedule.recurringType === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Day of Week
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => updateSchedule('recurringDay', day.value)}
                          disabled={readonly}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            localSchedule.recurringDay === day.value
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day Selection for Monthly */}
                {(localSchedule.recurringType === 'monthly' || localSchedule.recurringType === 'quarterly') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Day of Month
                    </label>
                    <select
                      value={localSchedule.recurringDay}
                      onChange={(e) => updateSchedule('recurringDay', parseInt(e.target.value))}
                      disabled={readonly}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                        </option>
                      ))}
                      <option value={-1}>Last day of month</option>
                    </select>
                  </div>
                )}

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Send Time
                  </label>
                  <input
                    type="time"
                    value={localSchedule.recurringTime}
                    onChange={(e) => updateSchedule('recurringTime', e.target.value)}
                    disabled={readonly}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Summary */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Repeat className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-purple-900">Schedule Summary</h4>
                      <p className="text-sm text-purple-700 mt-1">
                        {localSchedule.recurringType === 'daily' && `Every day at ${localSchedule.recurringTime}`}
                        {localSchedule.recurringType === 'weekly' && `Every ${weekDays.find(d => d.value === localSchedule.recurringDay)?.label || 'Monday'} at ${localSchedule.recurringTime}`}
                        {localSchedule.recurringType === 'biweekly' && `Every 2 weeks on ${weekDays.find(d => d.value === localSchedule.recurringDay)?.label || 'Monday'} at ${localSchedule.recurringTime}`}
                        {localSchedule.recurringType === 'monthly' && `Monthly on the ${localSchedule.recurringDay === -1 ? 'last day' : localSchedule.recurringDay + (localSchedule.recurringDay === 1 ? 'st' : localSchedule.recurringDay === 2 ? 'nd' : localSchedule.recurringDay === 3 ? 'rd' : 'th')} at ${localSchedule.recurringTime}`}
                        {localSchedule.recurringType === 'quarterly' && `Every 3 months on the ${localSchedule.recurringDay === -1 ? 'last day' : localSchedule.recurringDay + (localSchedule.recurringDay === 1 ? 'st' : localSchedule.recurringDay === 2 ? 'nd' : localSchedule.recurringDay === 3 ? 'rd' : 'th')} at ${localSchedule.recurringTime}`}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Rate Limits Tab */}
        {activeTab === 'limits' && (
          <div className="space-y-6">
            {/* Rate Limiting */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSchedule.enableRateLimit}
                  onChange={(e) => updateSchedule('enableRateLimit', e.target.checked)}
                  disabled={readonly}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Enable Rate Limiting</span>
                  <p className="text-sm text-gray-500">Limit how often the same user sees this survey</p>
                </div>
              </label>

              {localSchedule.enableRateLimit && (
                <div className="mt-4 pl-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Show to same user every
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={localSchedule.rateLimitDays}
                      onChange={(e) => updateSchedule('rateLimitDays', parseInt(e.target.value) || 1)}
                      disabled={readonly}
                      className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-gray-600">days</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Users who have seen or completed the survey won't see it again for {localSchedule.rateLimitDays} days
                  </p>
                </div>
              )}
            </div>

            {/* Response Quota */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSchedule.enableQuota}
                  onChange={(e) => updateSchedule('enableQuota', e.target.checked)}
                  disabled={readonly}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Enable Response Quota</span>
                  <p className="text-sm text-gray-500">Stop collecting responses after reaching a limit</p>
                </div>
              </label>

              {localSchedule.enableQuota && (
                <div className="mt-4 pl-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum responses
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      value={localSchedule.maxResponses}
                      onChange={(e) => updateSchedule('maxResponses', parseInt(e.target.value) || 1)}
                      disabled={readonly}
                      className="w-32 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-gray-600">responses</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Survey will automatically pause after {localSchedule.maxResponses.toLocaleString()} responses
                  </p>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-900">Rate Limit Tracking</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Rate limits are tracked using browser cookies and user IDs (if logged in).
                    Users who clear cookies may see the survey again sooner.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Display Tab */}
        {activeTab === 'display' && (
          <div className="space-y-6">
            {/* Show Delay */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Timer className="w-4 h-4 inline mr-2" />
                Display Delay
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Wait before showing the survey to the user
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={localSchedule.showDelay}
                  onChange={(e) => updateSchedule('showDelay', parseInt(e.target.value) || 0)}
                  disabled={readonly}
                  className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-gray-600">seconds</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {[0, 5, 10, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => updateSchedule('showDelay', sec)}
                    disabled={readonly}
                    className={`px-3 py-1 rounded text-sm ${
                      localSchedule.showDelay === sec
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {sec === 0 ? 'Immediately' : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-dismiss */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Auto-dismiss After
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Automatically hide the survey if not interacted with
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={localSchedule.showDuration}
                  onChange={(e) => updateSchedule('showDuration', parseInt(e.target.value) || 0)}
                  disabled={readonly}
                  className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-gray-600">seconds (0 = never)</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {[0, 30, 60, 120, 300].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => updateSchedule('showDuration', sec)}
                    disabled={readonly}
                    className={`px-3 py-1 rounded text-sm ${
                      localSchedule.showDuration === sec
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {sec === 0 ? 'Never' : sec < 60 ? `${sec}s` : `${sec / 60}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Display Preview</h4>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                    <Play className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Delay</p>
                    <p className="font-medium">{localSchedule.showDelay}s</p>
                  </div>
                </div>
                <div className="flex-1 h-2 bg-gray-200 rounded relative">
                  <div
                    className="absolute left-0 top-0 h-full bg-purple-500 rounded"
                    style={{ width: localSchedule.showDuration > 0 ? '60%' : '100%' }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                    <Pause className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Auto-hide</p>
                    <p className="font-medium">
                      {localSchedule.showDuration > 0 ? `${localSchedule.showDuration}s` : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              {localSchedule.startDate ? `Starts ${localSchedule.startDate}` : 'Starts immediately'}
            </span>
          </div>
          {localSchedule.endDate && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Ends {localSchedule.endDate}</span>
            </div>
          )}
          {localSchedule.isRecurring && (
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-purple-500" />
              <span className="text-purple-600 font-medium">
                {recurringOptions.find(o => o.value === localSchedule.recurringType)?.label}
              </span>
            </div>
          )}
          {localSchedule.enableRateLimit && (
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-blue-500" />
              <span className="text-blue-600">Every {localSchedule.rateLimitDays} days</span>
            </div>
          )}
          {localSchedule.enableQuota && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <span className="text-amber-600">Max {localSchedule.maxResponses.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyScheduler;

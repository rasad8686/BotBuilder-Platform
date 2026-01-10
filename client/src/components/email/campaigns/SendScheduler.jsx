import React from 'react';
import { Send, Clock, Sparkles, AlertCircle, Globe } from 'lucide-react';

const SendScheduler = ({
  scheduleType,
  scheduledAt,
  optimalTime,
  onChange,
  error
}) => {
  const timezones = [
    { value: 'Asia/Baku', label: 'Asia/Baku (UTC+4)' },
    { value: 'Europe/London', label: 'Europe/London (GMT)' },
    { value: 'America/New_York', label: 'America/New York (EST)' },
    { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' }
  ];

  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const formatTimeForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toTimeString().slice(0, 5);
  };

  const handleDateChange = (dateStr) => {
    const currentDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const [year, month, day] = dateStr.split('-');
    currentDate.setFullYear(year, month - 1, day);
    onChange({ scheduled_at: currentDate.toISOString() });
  };

  const handleTimeChange = (timeStr) => {
    const currentDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const [hours, minutes] = timeStr.split(':');
    currentDate.setHours(hours, minutes);
    onChange({ scheduled_at: currentDate.toISOString() });
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">When to Send</h3>

      <div className="space-y-3">
        {/* Send Now Option */}
        <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
          scheduleType === 'now'
            ? 'border-green-500 bg-green-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}>
          <input
            type="radio"
            name="schedule_type"
            value="now"
            checked={scheduleType === 'now'}
            onChange={() => onChange({ schedule_type: 'now', scheduled_at: null })}
            className="mt-0.5 w-4 h-4 text-green-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-green-600" />
              <span className="font-medium text-gray-900">Send Now</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Start sending immediately after confirmation
            </p>
          </div>
        </label>

        {/* Schedule for Later Option */}
        <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
          scheduleType === 'later'
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}>
          <input
            type="radio"
            name="schedule_type"
            value="later"
            checked={scheduleType === 'later'}
            onChange={() => onChange({ schedule_type: 'later' })}
            className="mt-0.5 w-4 h-4 text-blue-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-gray-900">Schedule for Later</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Choose a specific date and time
            </p>

            {scheduleType === 'later' && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={formatDateForInput(scheduledAt)}
                    onChange={(e) => handleDateChange(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="time"
                    value={formatTimeForInput(scheduledAt)}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Globe className="w-4 h-4" />
                  <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </label>

        {/* Optimal Time Option */}
        <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
          optimalTime
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}>
          <input
            type="checkbox"
            checked={optimalTime}
            onChange={(e) => onChange({ optimal_time: e.target.checked })}
            className="w-4 h-4 text-purple-600 rounded"
          />
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <div>
              <span className="text-sm font-medium text-gray-900">
                Send at optimal time for each recipient
              </span>
              <p className="text-xs text-gray-500">
                AI will determine the best time based on past engagement
              </p>
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};

export default SendScheduler;

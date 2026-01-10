/**
 * Business Hours Editor Component
 * Edit weekly business hours schedule
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Plus, Trash2, Copy } from 'lucide-react';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_HOURS = { start: '09:00', end: '17:00' };

const BusinessHoursEditor = ({ schedule = {}, onChange }) => {
  const { t } = useTranslation();

  const handleDayToggle = (day) => {
    const newSchedule = { ...schedule };
    if (newSchedule[day]?.enabled) {
      newSchedule[day] = { enabled: false, hours: [] };
    } else {
      newSchedule[day] = {
        enabled: true,
        hours: [{ ...DEFAULT_HOURS }],
      };
    }
    onChange(newSchedule);
  };

  const handleAddSlot = (day) => {
    const newSchedule = { ...schedule };
    const currentHours = newSchedule[day]?.hours || [];
    const lastSlot = currentHours[currentHours.length - 1];

    // Calculate new slot starting after the last one
    let newStart = '13:00';
    let newEnd = '17:00';

    if (lastSlot) {
      const lastEndHour = parseInt(lastSlot.end.split(':')[0]);
      newStart = `${String(lastEndHour + 1).padStart(2, '0')}:00`;
      newEnd = `${String(Math.min(lastEndHour + 5, 23)).padStart(2, '0')}:00`;
    }

    newSchedule[day] = {
      enabled: true,
      hours: [...currentHours, { start: newStart, end: newEnd }],
    };
    onChange(newSchedule);
  };

  const handleRemoveSlot = (day, slotIndex) => {
    const newSchedule = { ...schedule };
    const hours = [...(newSchedule[day]?.hours || [])];
    hours.splice(slotIndex, 1);

    if (hours.length === 0) {
      newSchedule[day] = { enabled: false, hours: [] };
    } else {
      newSchedule[day] = { enabled: true, hours };
    }
    onChange(newSchedule);
  };

  const handleSlotChange = (day, slotIndex, field, value) => {
    const newSchedule = { ...schedule };
    const hours = [...(newSchedule[day]?.hours || [])];
    hours[slotIndex] = { ...hours[slotIndex], [field]: value };
    newSchedule[day] = { ...newSchedule[day], hours };
    onChange(newSchedule);
  };

  const handleCopyToAll = (sourceDay) => {
    const sourceDayData = schedule[sourceDay];
    if (!sourceDayData?.enabled) return;

    const newSchedule = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      if (key !== 'saturday' && key !== 'sunday') {
        newSchedule[key] = {
          enabled: true,
          hours: sourceDayData.hours.map(h => ({ ...h })),
        };
      } else {
        newSchedule[key] = schedule[key] || { enabled: false, hours: [] };
      }
    });
    onChange(newSchedule);
  };

  const handleApplyWeekdayTemplate = () => {
    const newSchedule = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      if (key !== 'saturday' && key !== 'sunday') {
        newSchedule[key] = {
          enabled: true,
          hours: [{ start: '09:00', end: '17:00' }],
        };
      } else {
        newSchedule[key] = { enabled: false, hours: [] };
      }
    });
    onChange(newSchedule);
  };

  const handleApply24x7 = () => {
    const newSchedule = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      newSchedule[key] = {
        enabled: true,
        hours: [{ start: '00:00', end: '23:59' }],
      };
    });
    onChange(newSchedule);
  };

  return (
    <div className="space-y-4">
      {/* Quick Templates */}
      <div className="flex flex-wrap gap-2 pb-4 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
          {t('tickets.businessHours.templates', 'Quick templates')}:
        </span>
        <button
          type="button"
          onClick={handleApplyWeekdayTemplate}
          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {t('tickets.businessHours.weekdays9to5', 'Weekdays 9-5')}
        </button>
        <button
          type="button"
          onClick={handleApply24x7}
          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {t('tickets.businessHours.24x7', '24/7')}
        </button>
      </div>

      {/* Days Grid */}
      <div className="space-y-3">
        {DAYS_OF_WEEK.map(({ key, label }) => {
          const dayData = schedule[key] || { enabled: false, hours: [] };
          const isEnabled = dayData.enabled;

          return (
            <div
              key={key}
              className={`p-3 rounded-lg border ${
                isEnabled
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Day Toggle */}
                  <button
                    type="button"
                    onClick={() => handleDayToggle(key)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      isEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {/* Day Label */}
                  <span className={`font-medium min-w-[100px] ${
                    isEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {t(`common.days.${key}`, label)}
                  </span>
                </div>

                {/* Time Slots or Closed */}
                <div className="flex-1 flex items-center justify-end gap-2">
                  {isEnabled ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {dayData.hours.map((slot, slotIndex) => (
                          <TimeSlot
                            key={slotIndex}
                            slot={slot}
                            onChange={(field, value) => handleSlotChange(key, slotIndex, field, value)}
                            onRemove={() => handleRemoveSlot(key, slotIndex)}
                            showRemove={dayData.hours.length > 1}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddSlot(key)}
                        className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title={t('tickets.businessHours.addSlot', 'Add time slot')}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyToAll(key)}
                        className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title={t('tickets.businessHours.copyToWeekdays', 'Copy to all weekdays')}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                      {t('tickets.businessHours.closed', 'Closed')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium">{t('tickets.businessHours.summary', 'Weekly Hours Summary')}</p>
            <p className="mt-1">
              {calculateTotalHours(schedule)} {t('tickets.businessHours.hoursPerWeek', 'hours per week')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Time Slot Component
 */
const TimeSlot = ({ slot, onChange, onRemove, showRemove }) => {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1">
      <input
        type="time"
        value={slot.start}
        onChange={(e) => onChange('start', e.target.value)}
        className="w-24 px-2 py-1 text-sm border-0 bg-transparent text-gray-900 dark:text-white focus:ring-0"
      />
      <span className="text-gray-400">-</span>
      <input
        type="time"
        value={slot.end}
        onChange={(e) => onChange('end', e.target.value)}
        className="w-24 px-2 py-1 text-sm border-0 bg-transparent text-gray-900 dark:text-white focus:ring-0"
      />
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-0.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

/**
 * Calculate total weekly hours
 */
function calculateTotalHours(schedule) {
  let totalMinutes = 0;

  DAYS_OF_WEEK.forEach(({ key }) => {
    const dayData = schedule[key];
    if (dayData?.enabled && dayData.hours) {
      dayData.hours.forEach((slot) => {
        const [startH, startM] = slot.start.split(':').map(Number);
        const [endH, endM] = slot.end.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        if (endMinutes > startMinutes) {
          totalMinutes += endMinutes - startMinutes;
        }
      });
    }
  });

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${hours}`;
}

export default BusinessHoursEditor;

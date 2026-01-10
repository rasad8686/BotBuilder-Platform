/**
 * Holiday Calendar Component
 * Manage holidays and non-working days
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  CalendarDays,
  PartyPopper,
} from 'lucide-react';

const HolidayCalendar = ({ holidays = [], onChange }) => {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handleAddHoliday = (holiday) => {
    const newHolidays = [...holidays, { ...holiday, id: Date.now().toString() }];
    newHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
    onChange(newHolidays);
    setShowAddModal(false);
  };

  const handleUpdateHoliday = (holiday) => {
    const newHolidays = holidays.map(h => h.id === holiday.id ? holiday : h);
    newHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
    onChange(newHolidays);
    setEditingHoliday(null);
  };

  const handleDeleteHoliday = (holidayId) => {
    onChange(holidays.filter(h => h.id !== holidayId));
  };

  const handleImportHolidays = async (country) => {
    // Pre-defined holidays for common countries
    const holidayTemplates = {
      US: [
        { name: "New Year's Day", date: `${new Date().getFullYear()}-01-01`, recurring: true },
        { name: 'Independence Day', date: `${new Date().getFullYear()}-07-04`, recurring: true },
        { name: 'Thanksgiving', date: `${new Date().getFullYear()}-11-28`, recurring: false },
        { name: 'Christmas Day', date: `${new Date().getFullYear()}-12-25`, recurring: true },
      ],
      UK: [
        { name: "New Year's Day", date: `${new Date().getFullYear()}-01-01`, recurring: true },
        { name: 'Good Friday', date: `${new Date().getFullYear()}-04-07`, recurring: false },
        { name: 'Christmas Day', date: `${new Date().getFullYear()}-12-25`, recurring: true },
        { name: 'Boxing Day', date: `${new Date().getFullYear()}-12-26`, recurring: true },
      ],
      DE: [
        { name: 'Neujahr', date: `${new Date().getFullYear()}-01-01`, recurring: true },
        { name: 'Tag der Arbeit', date: `${new Date().getFullYear()}-05-01`, recurring: true },
        { name: 'Tag der Deutschen Einheit', date: `${new Date().getFullYear()}-10-03`, recurring: true },
        { name: 'Weihnachten', date: `${new Date().getFullYear()}-12-25`, recurring: true },
      ],
    };

    const newHolidays = holidayTemplates[country] || [];
    const existingDates = new Set(holidays.map(h => h.date));

    const toAdd = newHolidays
      .filter(h => !existingDates.has(h.date))
      .map(h => ({ ...h, id: Date.now().toString() + Math.random() }));

    if (toAdd.length > 0) {
      const merged = [...holidays, ...toAdd];
      merged.sort((a, b) => new Date(a.date) - new Date(b.date));
      onChange(merged);
    }
  };

  // Calendar navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // Get calendar days
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];

    // Empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split('T')[0];
      const holiday = holidays.find(h => h.date === dateStr);
      days.push({ date, dateStr, holiday });
    }

    return days;
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Group holidays by month for list view
  const groupedHolidays = holidays.reduce((acc, holiday) => {
    const date = new Date(holiday.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(holiday);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            {t('tickets.businessHours.holidays', 'Holidays & Non-Working Days')}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => e.target.value && handleImportHolidays(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            defaultValue=""
          >
            <option value="" disabled>{t('tickets.businessHours.importHolidays', 'Import holidays...')}</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
            <option value="DE">Germany</option>
          </select>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('tickets.businessHours.addHoliday', 'Add Holiday')}
          </button>
        </div>
      </div>

      {/* Mini Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h4 className="font-medium text-gray-900 dark:text-white">{monthName}</h4>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}

          {/* Days */}
          {getDaysInMonth().map((day, index) => (
            <div
              key={index}
              className={`relative aspect-square p-1 ${
                day ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''
              }`}
              onClick={() => day && !day.holiday && setShowAddModal(true)}
            >
              {day && (
                <>
                  <span className={`text-sm ${
                    day.holiday
                      ? 'font-bold text-red-600 dark:text-red-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {day.date.getDate()}
                  </span>
                  {day.holiday && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Holiday List */}
      {holidays.length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedHolidays).map(([monthKey, monthHolidays]) => {
            const [year, month] = monthKey.split('-');
            const monthDate = new Date(parseInt(year), parseInt(month) - 1);
            const monthLabel = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

            return (
              <div key={monthKey}>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {monthLabel}
                </h4>
                <div className="space-y-2">
                  {monthHolidays.map((holiday) => (
                    <HolidayItem
                      key={holiday.id}
                      holiday={holiday}
                      onEdit={() => setEditingHoliday(holiday)}
                      onDelete={() => handleDeleteHoliday(holiday.id)}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <PartyPopper className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">
            {t('tickets.businessHours.noHolidays', 'No holidays configured')}
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {t('tickets.businessHours.addFirstHoliday', 'Add your first holiday')}
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingHoliday) && (
        <HolidayModal
          holiday={editingHoliday}
          onClose={() => {
            setShowAddModal(false);
            setEditingHoliday(null);
          }}
          onSave={editingHoliday ? handleUpdateHoliday : handleAddHoliday}
          t={t}
        />
      )}
    </div>
  );
};

/**
 * Holiday Item Component
 */
const HolidayItem = ({ holiday, onEdit, onDelete, t }) => {
  const date = new Date(holiday.date);
  const formattedDate = date.toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{holiday.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formattedDate}
            {holiday.recurring && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                {t('tickets.businessHours.recurring', 'Recurring')}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * Holiday Modal Component
 */
const HolidayModal = ({ holiday, onClose, onSave, t }) => {
  const [formData, setFormData] = useState({
    name: holiday?.name || '',
    date: holiday?.date || new Date().toISOString().split('T')[0],
    recurring: holiday?.recurring || false,
    id: holiday?.id,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.date) {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">
            {holiday
              ? t('tickets.businessHours.editHoliday', 'Edit Holiday')
              : t('tickets.businessHours.addHoliday', 'Add Holiday')
            }
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('tickets.businessHours.holidayName', 'Holiday Name')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={t('tickets.businessHours.holidayNamePlaceholder', 'e.g., Christmas Day')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('tickets.businessHours.date', 'Date')}
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.recurring}
              onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('tickets.businessHours.recurringYearly', 'Recurring yearly')}
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {holiday ? t('common.save', 'Save') : t('common.add', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HolidayCalendar;

/**
 * BusinessHoursPage
 * Manage business hours and holidays
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Edit,
  Clock,
  Calendar,
  Globe,
  CheckCircle,
  X,
  Save
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import BusinessHoursEditor from '../../components/tickets/automation/BusinessHoursEditor';
import HolidayCalendar from '../../components/tickets/automation/HolidayCalendar';

// Timezone options
const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Baku', label: 'Baku (AZT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'America/Chicago', label: 'Chicago (CST)' },
];

// Default schedule
const DEFAULT_SCHEDULE = {
  monday: { start: '09:00', end: '18:00' },
  tuesday: { start: '09:00', end: '18:00' },
  wednesday: { start: '09:00', end: '18:00' },
  thursday: { start: '09:00', end: '18:00' },
  friday: { start: '09:00', end: '18:00' },
  saturday: null,
  sunday: null,
};

/**
 * Business Hours Card
 */
function BusinessHoursCard({ hours, onEdit, onDelete, onSetDefault }) {
  const { t } = useTranslation();
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg border ${
      hours.is_default
        ? 'border-blue-300 dark:border-blue-700'
        : 'border-gray-200 dark:border-slate-700'
    } p-6`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {hours.name}
            {hours.is_default && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                {t('businessHours.default', 'Default')}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <Globe className="w-4 h-4" />
            {hours.timezone}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!hours.is_default && (
            <button
              onClick={() => onSetDefault(hours.id)}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              title={t('businessHours.setDefault', 'Set as default')}
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => onEdit(hours)}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(hours.id)}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Schedule grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const daySchedule = hours.schedule?.[day];
          const isOpen = daySchedule && daySchedule.start && daySchedule.end;

          return (
            <div key={day} className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {day.substring(0, 3).toUpperCase()}
              </div>
              <div className={`p-2 rounded ${
                isOpen
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
              }`}>
                {isOpen ? (
                  <div className="text-xs">
                    <div>{daySchedule.start}</div>
                    <div>{daySchedule.end}</div>
                  </div>
                ) : (
                  <div className="text-xs">Closed</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Holidays count */}
      {hours.holidays?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            {hours.holidays.length} {t('businessHours.holidays', 'holidays')} {t('businessHours.configured', 'configured')}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Edit Modal
 */
function EditModal({ hours, onSave, onClose }) {
  const { t } = useTranslation();
  const [name, setName] = useState(hours?.name || '');
  const [timezone, setTimezone] = useState(hours?.timezone || 'UTC');
  const [schedule, setSchedule] = useState(hours?.schedule || DEFAULT_SCHEDULE);
  const [holidays, setHolidays] = useState(hours?.holidays || []);
  const [isDefault, setIsDefault] = useState(hours?.is_default || false);
  const [activeTab, setActiveTab] = useState('schedule');

  const handleSave = () => {
    onSave({
      id: hours?.id,
      name,
      timezone,
      schedule,
      holidays,
      is_default: isDefault,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {hours ? t('businessHours.edit', 'Edit Business Hours') : t('businessHours.create', 'Create Business Hours')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="flex px-4">
            {[
              { id: 'schedule', label: t('businessHours.schedule', 'Schedule') },
              { id: 'holidays', label: t('businessHours.holidays', 'Holidays') },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('businessHours.name', 'Name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  placeholder={t('businessHours.namePlaceholder', 'e.g., Standard Business Hours')}
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('businessHours.timezone', 'Timezone')}
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              {/* Schedule Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t('businessHours.weeklySchedule', 'Weekly Schedule')}
                </label>
                <BusinessHoursEditor
                  schedule={schedule}
                  onChange={setSchedule}
                />
              </div>

              {/* Default checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_default" className="text-sm text-gray-700 dark:text-gray-300">
                  {t('businessHours.setAsDefault', 'Set as default business hours')}
                </label>
              </div>
            </div>
          )}

          {activeTab === 'holidays' && (
            <HolidayCalendar
              holidays={holidays}
              onChange={setHolidays}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * BusinessHoursPage Component
 */
export default function BusinessHoursPage() {
  const { t } = useTranslation();
  const api = useApi();

  const [businessHours, setBusinessHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHours, setEditingHours] = useState(null);

  // Fetch business hours
  const fetchBusinessHours = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/tickets/business-hours');
      setBusinessHours(response.data.business_hours || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchBusinessHours();
  }, [fetchBusinessHours]);

  // Edit hours
  const handleEdit = (hours) => {
    setEditingHours(hours);
    setShowEditModal(true);
  };

  // Delete hours
  const handleDelete = async (id) => {
    if (!window.confirm(t('businessHours.confirmDelete', 'Are you sure you want to delete these business hours?'))) {
      return;
    }
    try {
      await api.delete(`/api/tickets/business-hours/${id}`);
      fetchBusinessHours();
    } catch (err) {
      console.error('Error deleting business hours:', err);
    }
  };

  // Set as default
  const handleSetDefault = async (id) => {
    try {
      await api.put(`/api/tickets/business-hours/${id}`, { is_default: true });
      fetchBusinessHours();
    } catch (err) {
      console.error('Error setting default:', err);
    }
  };

  // Save hours
  const handleSave = async (data) => {
    try {
      if (data.id) {
        await api.put(`/api/tickets/business-hours/${data.id}`, data);
      } else {
        await api.post('/api/tickets/business-hours', data);
      }
      setShowEditModal(false);
      setEditingHours(null);
      fetchBusinessHours();
    } catch (err) {
      console.error('Error saving business hours:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('businessHours.title', 'Business Hours')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('businessHours.description', 'Configure working hours for SLA calculations')}
            </p>
          </div>

          <button
            onClick={() => {
              setEditingHours(null);
              setShowEditModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {t('businessHours.add', 'Add Business Hours')}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : businessHours.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('businessHours.noHours', 'No business hours configured')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t('businessHours.createFirst', 'Set up your working hours for accurate SLA calculations')}
            </p>
            <button
              onClick={() => {
                setEditingHours(null);
                setShowEditModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              {t('businessHours.create', 'Create Business Hours')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {businessHours.map(hours => (
              <BusinessHoursCard
                key={hours.id}
                hours={hours}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
              />
            ))}
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <EditModal
            hours={editingHours}
            onSave={handleSave}
            onClose={() => {
              setShowEditModal(false);
              setEditingHours(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

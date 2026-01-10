import React, { useState, useEffect } from 'react';
import { X, Save, Eye, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BannerPreview from './BannerPreview';

/**
 * BannerForm Component
 * Modal/Dialog for creating and editing banners
 */
export default function BannerForm({ isOpen, onClose, onSave, banner = null, isLoading = false }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    background_color: '',
    text_color: '',
    link_url: '',
    link_text: '',
    target_audience: 'all',
    start_date: '',
    end_date: '',
    is_dismissible: true,
    is_active: true,
    priority: 0
  });
  const [errors, setErrors] = useState({});
  const [showCustomColors, setShowCustomColors] = useState(false);

  // Banner types with labels
  const bannerTypes = [
    { value: 'info', label: t('banners.typeInfo', 'Info') },
    { value: 'warning', label: t('banners.typeWarning', 'Warning') },
    { value: 'success', label: t('banners.typeSuccess', 'Success') },
    { value: 'error', label: t('banners.typeError', 'Error') },
    { value: 'promo', label: t('banners.typePromo', 'Promo') }
  ];

  // Target audience options
  const audienceOptions = [
    { value: 'all', label: t('banners.audienceAll', 'All Users') },
    { value: 'free', label: t('banners.audienceFree', 'Free Plan') },
    { value: 'paid', label: t('banners.audiencePaid', 'Paid Plan') },
    { value: 'trial', label: t('banners.audienceTrial', 'Trial Users') }
  ];

  // Initialize form with banner data when editing
  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title || '',
        message: banner.message || '',
        type: banner.type || 'info',
        background_color: banner.background_color || '',
        text_color: banner.text_color || '',
        link_url: banner.link_url || '',
        link_text: banner.link_text || '',
        target_audience: banner.target_audience || 'all',
        start_date: banner.start_date ? formatDateForInput(banner.start_date) : '',
        end_date: banner.end_date ? formatDateForInput(banner.end_date) : '',
        is_dismissible: banner.is_dismissible !== false,
        is_active: banner.is_active !== false,
        priority: banner.priority || 0
      });
      setShowCustomColors(!!banner.background_color || !!banner.text_color);
    } else {
      // Reset form for new banner
      setFormData({
        title: '',
        message: '',
        type: 'info',
        background_color: '',
        text_color: '',
        link_url: '',
        link_text: '',
        target_audience: 'all',
        start_date: formatDateForInput(new Date()),
        end_date: '',
        is_dismissible: true,
        is_active: true,
        priority: 0
      });
      setShowCustomColors(false);
    }
    setErrors({});
  }, [banner, isOpen]);

  // Format date for datetime-local input
  function formatDateForInput(date) {
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  }

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // URL validation helper
  const isValidUrl = (url) => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};
    const title = formData.title.trim();
    const message = formData.message.trim();

    // Title validation
    if (!title) {
      newErrors.title = t('banners.errorTitleRequired', 'Title is required');
    } else if (title.length < 3) {
      newErrors.title = t('banners.errorTitleMinLength', 'Title must be at least 3 characters');
    } else if (title.length > 255) {
      newErrors.title = t('banners.errorTitleMaxLength', 'Title cannot exceed 255 characters');
    }

    // Message validation
    if (!message) {
      newErrors.message = t('banners.errorMessageRequired', 'Message is required');
    } else if (message.length < 10) {
      newErrors.message = t('banners.errorMessageMinLength', 'Message must be at least 10 characters');
    } else if (message.length > 1000) {
      newErrors.message = t('banners.errorMessageMaxLength', 'Message cannot exceed 1000 characters');
    }

    // Start date validation
    if (!formData.start_date) {
      newErrors.start_date = t('banners.errorStartDateRequired', 'Start date is required');
    } else if (!banner) {
      // For new banners, start date should be in the future
      const startDate = new Date(formData.start_date);
      const now = new Date();
      // Allow a 5 minute buffer for form filling
      now.setMinutes(now.getMinutes() - 5);
      if (startDate < now) {
        newErrors.start_date = t('banners.errorStartDateFuture', 'Start date must be in the future for new banners');
      }
    }

    // End date validation
    if (formData.end_date && formData.start_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      if (endDate <= startDate) {
        newErrors.end_date = t('banners.errorEndDateInvalid', 'End date must be after start date');
      }
    }

    // Link URL validation
    if (formData.link_url && !isValidUrl(formData.link_url)) {
      newErrors.link_url = t('banners.errorLinkUrlInvalid', 'Please enter a valid URL');
    }

    // Link text validation
    if (formData.link_url && !formData.link_text) {
      newErrors.link_text = t('banners.errorLinkTextRequired', 'Link text is required when URL is provided');
    }

    // Priority validation
    const priority = parseInt(formData.priority, 10);
    if (isNaN(priority) || priority < 0 || priority > 100) {
      newErrors.priority = t('banners.errorPriorityRange', 'Priority must be between 0 and 100');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Prepare data for submission
      const submitData = {
        ...formData,
        background_color: showCustomColors ? formData.background_color : null,
        text_color: showCustomColors ? formData.text_color : null,
        end_date: formData.end_date || null,
        priority: parseInt(formData.priority, 10) || 0
      };
      onSave(submitData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {banner ? t('banners.editBanner', 'Edit Banner') : t('banners.createBanner', 'Create Banner')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Preview Section */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Eye className="w-4 h-4" />
                {t('banners.preview', 'Preview')}
              </label>
              <BannerPreview banner={formData} />
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('banners.title', 'Title')} *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}`}
                placeholder={t('banners.titlePlaceholder', 'Enter banner title')}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-500">{errors.title}</p>
              )}
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('banners.message', 'Message')} *
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={3}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.message ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}`}
                placeholder={t('banners.messagePlaceholder', 'Enter banner message')}
              />
              {errors.message && (
                <p className="mt-1 text-sm text-red-500">{errors.message}</p>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('banners.type', 'Type')}
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {bannerTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Colors Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showCustomColors"
                checked={showCustomColors}
                onChange={(e) => setShowCustomColors(e.target.checked)}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="showCustomColors" className="text-sm text-gray-700 dark:text-gray-300">
                {t('banners.useCustomColors', 'Use custom colors')}
              </label>
            </div>

            {/* Custom Colors */}
            {showCustomColors && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('banners.backgroundColor', 'Background Color')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="background_color"
                      value={formData.background_color || '#3b82f6'}
                      onChange={handleChange}
                      className="w-10 h-10 border border-gray-300 dark:border-slate-600 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      name="background_color"
                      value={formData.background_color}
                      onChange={handleChange}
                      placeholder="#3b82f6"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('banners.textColor', 'Text Color')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="text_color"
                      value={formData.text_color || '#ffffff'}
                      onChange={handleChange}
                      className="w-10 h-10 border border-gray-300 dark:border-slate-600 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      name="text_color"
                      value={formData.text_color}
                      onChange={handleChange}
                      placeholder="#ffffff"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Link URL & Link Text */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('banners.linkUrl', 'Link URL')}
                </label>
                <input
                  type="url"
                  name="link_url"
                  value={formData.link_url}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.link_url ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}`}
                  placeholder="https://..."
                />
                {errors.link_url && (
                  <p className="mt-1 text-sm text-red-500">{errors.link_url}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('banners.linkText', 'Link Text')}
                </label>
                <input
                  type="text"
                  name="link_text"
                  value={formData.link_text}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.link_text ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}`}
                  placeholder={t('banners.linkTextPlaceholder', 'Learn More')}
                />
                {errors.link_text && (
                  <p className="mt-1 text-sm text-red-500">{errors.link_text}</p>
                )}
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('banners.targetAudience', 'Target Audience')}
              </label>
              <select
                name="target_audience"
                value={formData.target_audience}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {audienceOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date & End Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('banners.startDate', 'Start Date')} *
                </label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className={`flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.start_date ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      now.setMinutes(now.getMinutes() + 1);
                      const year = now.getFullYear();
                      const month = String(now.getMonth() + 1).padStart(2, '0');
                      const day = String(now.getDate()).padStart(2, '0');
                      const hours = String(now.getHours()).padStart(2, '0');
                      const minutes = String(now.getMinutes()).padStart(2, '0');
                      const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
                      setFormData(prev => ({ ...prev, start_date: formatted }));
                    }}
                    className="px-3 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-1 whitespace-nowrap"
                  >
                    <Play className="w-4 h-4" />
                    Start Now
                  </button>
                </div>
                {errors.start_date && (
                  <p className="mt-1 text-sm text-red-500">{errors.start_date}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('banners.endDate', 'End Date')}
                </label>
                <input
                  type="datetime-local"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.end_date ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}`}
                />
                {errors.end_date && (
                  <p className="mt-1 text-sm text-red-500">{errors.end_date}</p>
                )}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('banners.priority', 'Priority')} (0-100)
              </label>
              <input
                type="number"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                min="0"
                max="100"
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.priority ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}`}
              />
              {errors.priority ? (
                <p className="mt-1 text-sm text-red-500">{errors.priority}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('banners.priorityHint', 'Higher priority banners are shown first')}
                </p>
              )}
            </div>

            {/* Checkboxes */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_dismissible"
                  checked={formData.is_dismissible}
                  onChange={handleChange}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('banners.isDismissible', 'Dismissible')}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('banners.isActive', 'Active')}
                </span>
              </label>
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {isLoading
                ? t('common.saving', 'Saving...')
                : banner
                  ? t('common.update', 'Update')
                  : t('common.create', 'Create')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

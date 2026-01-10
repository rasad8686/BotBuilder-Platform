import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, User, Phone, Building2, Briefcase } from 'lucide-react';
import ContactTagsInput from './ContactTagsInput';

const ContactForm = ({ data, onChange, errors, lists = [] }) => {
  const { t } = useTranslation();

  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            {t('email.contactForm.email', 'Email')} *
          </div>
        </label>
        <input
          type="email"
          value={data.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="john@example.com"
          className={`
            w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-900
            text-gray-900 dark:text-white
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}
          `}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-500">{errors.email}</p>
        )}
      </div>

      {/* Name Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {t('email.contactForm.firstName', 'First Name')}
            </div>
          </label>
          <input
            type="text"
            value={data.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
            placeholder="John"
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('email.contactForm.lastName', 'Last Name')}
          </label>
          <input
            type="text"
            value={data.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            placeholder="Doe"
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            {t('email.contactForm.phone', 'Phone')}
          </div>
        </label>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="+1 234 567 8900"
          className={`
            w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-900
            text-gray-900 dark:text-white
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${errors.phone ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}
          `}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
        )}
      </div>

      {/* Company & Job Title */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {t('email.contactForm.company', 'Company')}
            </div>
          </label>
          <input
            type="text"
            value={data.company}
            onChange={(e) => handleChange('company', e.target.value)}
            placeholder="Acme Inc"
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              {t('email.contactForm.jobTitle', 'Job Title')}
            </div>
          </label>
          <input
            type="text"
            value={data.job_title}
            onChange={(e) => handleChange('job_title', e.target.value)}
            placeholder="CEO"
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('email.contactForm.tags', 'Tags')}
        </label>
        <ContactTagsInput
          tags={data.tags}
          onChange={(tags) => handleChange('tags', tags)}
          editable
        />
      </div>

      {/* Lists */}
      {lists.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('email.contactForm.lists', 'Add to Lists')}
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-lg p-3">
            {lists.map(list => (
              <label
                key={list.id}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(data.lists || []).includes(list.id)}
                  onChange={(e) => {
                    const currentLists = data.lists || [];
                    const updated = e.target.checked
                      ? [...currentLists, list.id]
                      : currentLists.filter(id => id !== list.id);
                    handleChange('lists', updated);
                  }}
                  className="text-blue-600 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{list.name}</p>
                  {list.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{list.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('email.contactForm.status', 'Subscription Status')}
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="subscribed"
              checked={data.status === 'subscribed'}
              onChange={(e) => handleChange('status', e.target.value)}
              className="text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('email.contactForm.subscribed', 'Subscribed')}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="unsubscribed"
              checked={data.status === 'unsubscribed'}
              onChange={(e) => handleChange('status', e.target.value)}
              className="text-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('email.contactForm.unsubscribed', 'Unsubscribed')}
            </span>
          </label>
        </div>
      </div>

      {/* Custom Fields */}
      {data.custom_fields && Object.keys(data.custom_fields).length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('email.contactForm.customFields', 'Custom Fields')}
          </label>
          <div className="space-y-3">
            {Object.entries(data.custom_fields).map(([key, value]) => (
              <div key={key} className="flex gap-3">
                <input
                  type="text"
                  value={key}
                  disabled
                  className="w-1/3 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    handleChange('custom_fields', {
                      ...data.custom_fields,
                      [key]: e.target.value
                    });
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactForm;

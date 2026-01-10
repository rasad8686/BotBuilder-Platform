import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Tag, ListFilter, Upload, ChevronDown } from 'lucide-react';
import { useTagsQuery } from '../../hooks/email/useContactTags';
import { useListsQuery } from '../../hooks/email/useLists';

const ContactFilters = ({ filters, onChange, onClear }) => {
  const { t } = useTranslation();
  const [openDropdown, setOpenDropdown] = useState(null);

  // Fetch tags and lists for filter options
  const { data: tagsData } = useTagsQuery();
  const { data: listsData } = useListsQuery();

  const tags = tagsData?.tags || [];
  const lists = listsData?.lists || [];

  const sources = [
    { id: 'manual', label: t('email.filters.sourceManual', 'Manual') },
    { id: 'import', label: t('email.filters.sourceImport', 'Import') },
    { id: 'chatbot', label: t('email.filters.sourceChatbot', 'Chatbot') },
    { id: 'form', label: t('email.filters.sourceForm', 'Form') },
    { id: 'api', label: t('email.filters.sourceAPI', 'API') }
  ];

  const statuses = [
    { id: 'subscribed', label: t('email.filters.subscribed', 'Subscribed') },
    { id: 'unsubscribed', label: t('email.filters.unsubscribed', 'Unsubscribed') },
    { id: 'bounced', label: t('email.filters.bounced', 'Bounced') },
    { id: 'complained', label: t('email.filters.complained', 'Complained') }
  ];

  // Toggle array filter
  const toggleFilter = (key, value) => {
    const current = filters[key] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: updated });
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return (
      (filters.status && filters.status.length > 0) ||
      (filters.tags && filters.tags.length > 0) ||
      (filters.lists && filters.lists.length > 0) ||
      (filters.source && filters.source.length > 0) ||
      (filters.dateRange && (filters.dateRange.start || filters.dateRange.end))
    );
  };

  // Filter dropdown component
  const FilterDropdown = ({ id, icon: Icon, label, children }) => (
    <div className="relative">
      <button
        onClick={() => setOpenDropdown(openDropdown === id ? null : id)}
        className={`
          flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors
          ${openDropdown === id
            ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
          }
        `}
      >
        <Icon className="w-4 h-4" />
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === id ? 'rotate-180' : ''}`} />
      </button>

      {openDropdown === id && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpenDropdown(null)}
          />
          <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-20 max-h-64 overflow-y-auto">
            {children}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        <FilterDropdown id="status" icon={ListFilter} label={t('email.filters.status', 'Status')}>
          {statuses.map(status => (
            <label
              key={status.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={(filters.status || []).includes(status.id)}
                onChange={() => toggleFilter('status', status.id)}
                className="text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{status.label}</span>
            </label>
          ))}
        </FilterDropdown>

        {/* Tags Filter */}
        <FilterDropdown id="tags" icon={Tag} label={t('email.filters.tags', 'Tags')}>
          {tags.length > 0 ? (
            tags.map(tag => (
              <label
                key={tag}
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(filters.tags || []).includes(tag)}
                  onChange={() => toggleFilter('tags', tag)}
                  className="text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{tag}</span>
              </label>
            ))
          ) : (
            <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              {t('email.filters.noTags', 'No tags available')}
            </p>
          )}
        </FilterDropdown>

        {/* Lists Filter */}
        <FilterDropdown id="lists" icon={ListFilter} label={t('email.filters.lists', 'Lists')}>
          {lists.length > 0 ? (
            lists.map(list => (
              <label
                key={list.id}
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(filters.lists || []).includes(list.id)}
                  onChange={() => toggleFilter('lists', list.id)}
                  className="text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{list.name}</span>
              </label>
            ))
          ) : (
            <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              {t('email.filters.noLists', 'No lists available')}
            </p>
          )}
        </FilterDropdown>

        {/* Source Filter */}
        <FilterDropdown id="source" icon={Upload} label={t('email.filters.source', 'Source')}>
          {sources.map(source => (
            <label
              key={source.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={(filters.source || []).includes(source.id)}
                onChange={() => toggleFilter('source', source.id)}
                className="text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{source.label}</span>
            </label>
          ))}
        </FilterDropdown>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={filters.dateRange?.start || ''}
            onChange={(e) => onChange({
              ...filters,
              dateRange: { ...filters.dateRange, start: e.target.value }
            })}
            className="px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300"
            placeholder={t('email.filters.from', 'From')}
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={filters.dateRange?.end || ''}
            onChange={(e) => onChange({
              ...filters,
              dateRange: { ...filters.dateRange, end: e.target.value }
            })}
            className="px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300"
            placeholder={t('email.filters.to', 'To')}
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters() && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <X className="w-4 h-4" />
            {t('email.filters.clearAll', 'Clear all')}
          </button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters() && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {(filters.status || []).map(status => (
            <span
              key={`status-${status}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full"
            >
              {statuses.find(s => s.id === status)?.label}
              <button onClick={() => toggleFilter('status', status)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(filters.tags || []).map(tag => (
            <span
              key={`tag-${tag}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-full"
            >
              {tag}
              <button onClick={() => toggleFilter('tags', tag)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(filters.lists || []).map(listId => (
            <span
              key={`list-${listId}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full"
            >
              {lists.find(l => l.id === listId)?.name}
              <button onClick={() => toggleFilter('lists', listId)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(filters.source || []).map(source => (
            <span
              key={`source-${source}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full"
            >
              {sources.find(s => s.id === source)?.label}
              <button onClick={() => toggleFilter('source', source)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContactFilters;

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, ArrowRight } from 'lucide-react';

const CSVColumnMapper = ({
  headers = [],
  mapping = {},
  onChange,
  fields = [],
  sampleData = []
}) => {
  const { t } = useTranslation();

  // Update mapping for a column
  const updateMapping = (header, field) => {
    const newMapping = { ...mapping };

    // If field is already mapped to another column, unmap it first
    if (field !== 'skip') {
      Object.keys(newMapping).forEach(key => {
        if (newMapping[key] === field) {
          delete newMapping[key];
        }
      });
    }

    if (field === 'skip' || field === '') {
      delete newMapping[header];
    } else {
      newMapping[header] = field;
    }

    onChange(newMapping);
  };

  // Get sample values for a column
  const getSampleValues = (header) => {
    return sampleData
      .map(row => row[header])
      .filter(Boolean)
      .slice(0, 3);
  };

  // Check if field is already mapped
  const isFieldMapped = (fieldId) => {
    return Object.values(mapping).includes(fieldId);
  };

  // Get required fields status
  const requiredFields = fields.filter(f => f.required);
  const mappedRequiredFields = requiredFields.filter(f => isFieldMapped(f.id));

  return (
    <div className="space-y-6">
      {/* Mapping status */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <div className="flex items-center gap-2">
          {mappedRequiredFields.length === requiredFields.length ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <X className="w-5 h-5 text-red-500" />
          )}
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('email.import.requiredMapped', '{{mapped}}/{{total}} required fields mapped', {
              mapped: mappedRequiredFields.length,
              total: requiredFields.length
            })}
          </span>
        </div>
        <div className="flex-1" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t('email.import.columnsMapped', '{{count}} columns mapped', {
            count: Object.keys(mapping).length
          })}
        </span>
      </div>

      {/* Column mappings */}
      <div className="space-y-4">
        {headers.map((header, index) => {
          const samples = getSampleValues(header);
          const currentMapping = mapping[header] || '';
          const mappedField = fields.find(f => f.id === currentMapping);

          return (
            <div
              key={index}
              className="flex items-center gap-4 p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
            >
              {/* Source column */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {header}
                </p>
                {samples.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {samples.map((sample, i) => (
                      <p key={i} className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {sample}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />

              {/* Target field */}
              <div className="flex-1 min-w-0">
                <select
                  value={currentMapping}
                  onChange={(e) => updateMapping(header, e.target.value)}
                  className={`
                    w-full px-3 py-2 border rounded-lg text-sm
                    bg-white dark:bg-slate-900 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${currentMapping
                      ? 'border-green-300 dark:border-green-600'
                      : 'border-gray-300 dark:border-slate-600'
                    }
                  `}
                >
                  <option value="">{t('email.import.selectField', 'Select field...')}</option>
                  {fields.map(field => (
                    <option
                      key={field.id}
                      value={field.id}
                      disabled={field.id !== 'skip' && field.id !== currentMapping && isFieldMapped(field.id)}
                    >
                      {field.label}
                      {field.required && ' *'}
                      {field.id !== 'skip' && field.id !== currentMapping && isFieldMapped(field.id) && ' (mapped)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mapping status indicator */}
              <div className="flex-shrink-0 w-8">
                {currentMapping && currentMapping !== 'skip' ? (
                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                ) : currentMapping === 'skip' ? (
                  <div className="w-6 h-6 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <X className="w-4 h-4 text-gray-400" />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
          </div>
          <span>{t('email.import.mapped', 'Mapped')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <X className="w-3 h-3 text-gray-400" />
          </div>
          <span>{t('email.import.skipped', 'Skipped')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-500">*</span>
          <span>{t('email.import.required', 'Required')}</span>
        </div>
      </div>
    </div>
  );
};

export default CSVColumnMapper;

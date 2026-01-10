import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Download, FileSpreadsheet, FileText, Check } from 'lucide-react';

const ExportModal = ({ onClose, onExport, selectedCount, totalCount }) => {
  const { t } = useTranslation();
  const [format, setFormat] = useState('csv');
  const [exportScope, setExportScope] = useState(selectedCount > 0 ? 'selected' : 'all');
  const [fields, setFields] = useState({
    email: true,
    first_name: true,
    last_name: true,
    phone: true,
    company: true,
    job_title: true,
    status: true,
    tags: true,
    created_at: true,
    source: false,
    last_activity: false
  });
  const [isExporting, setIsExporting] = useState(false);

  const availableFields = [
    { id: 'email', label: t('email.export.fieldEmail', 'Email') },
    { id: 'first_name', label: t('email.export.fieldFirstName', 'First Name') },
    { id: 'last_name', label: t('email.export.fieldLastName', 'Last Name') },
    { id: 'phone', label: t('email.export.fieldPhone', 'Phone') },
    { id: 'company', label: t('email.export.fieldCompany', 'Company') },
    { id: 'job_title', label: t('email.export.fieldJobTitle', 'Job Title') },
    { id: 'status', label: t('email.export.fieldStatus', 'Status') },
    { id: 'tags', label: t('email.export.fieldTags', 'Tags') },
    { id: 'created_at', label: t('email.export.fieldCreatedAt', 'Created Date') },
    { id: 'source', label: t('email.export.fieldSource', 'Source') },
    { id: 'last_activity', label: t('email.export.fieldLastActivity', 'Last Activity') }
  ];

  const toggleField = (fieldId) => {
    setFields(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));
  };

  const selectAll = () => {
    const allSelected = Object.values(fields).every(v => v);
    setFields(Object.fromEntries(
      Object.keys(fields).map(k => [k, !allSelected])
    ));
  };

  const handleExport = async () => {
    const selectedFields = Object.entries(fields)
      .filter(([_, selected]) => selected)
      .map(([id]) => id);

    if (selectedFields.length === 0) return;

    setIsExporting(true);
    try {
      await onExport({
        format,
        fields: selectedFields,
        scope: exportScope
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportCount = exportScope === 'selected' ? selectedCount : totalCount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('email.export.title', 'Export Contacts')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Export scope */}
          {selectedCount > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('email.export.scope', 'Export')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                  <input
                    type="radio"
                    name="scope"
                    value="selected"
                    checked={exportScope === 'selected'}
                    onChange={(e) => setExportScope(e.target.value)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t('email.export.selectedOnly', 'Selected contacts ({{count}})', { count: selectedCount })}
                  </span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={exportScope === 'all'}
                    onChange={(e) => setExportScope(e.target.value)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t('email.export.allContacts', 'All contacts ({{count}})', { count: totalCount })}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('email.export.format', 'Format')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`
                  flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors
                  ${format === 'csv'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-slate-600 hover:border-blue-300'
                  }
                `}
              >
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value)}
                  className="sr-only"
                />
                <FileText className={`w-6 h-6 ${
                  format === 'csv' ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <div>
                  <p className={`font-medium ${
                    format === 'csv' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}>CSV</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">.csv</p>
                </div>
              </label>

              <label
                className={`
                  flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors
                  ${format === 'excel'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-slate-600 hover:border-blue-300'
                  }
                `}
              >
                <input
                  type="radio"
                  name="format"
                  value="excel"
                  checked={format === 'excel'}
                  onChange={(e) => setFormat(e.target.value)}
                  className="sr-only"
                />
                <FileSpreadsheet className={`w-6 h-6 ${
                  format === 'excel' ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <div>
                  <p className={`font-medium ${
                    format === 'excel' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}>Excel</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">.xlsx</p>
                </div>
              </label>
            </div>
          </div>

          {/* Fields selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('email.export.fields', 'Fields to include')}
              </label>
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:underline"
              >
                {Object.values(fields).every(v => v)
                  ? t('email.export.deselectAll', 'Deselect all')
                  : t('email.export.selectAll', 'Select all')
                }
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border border-gray-200 dark:border-slate-600 rounded-lg">
              {availableFields.map(field => (
                <label
                  key={field.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={fields[field.id]}
                    onChange={() => toggleField(field.id)}
                    className="text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            {t('email.export.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || Object.values(fields).every(v => !v)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('email.export.exporting', 'Exporting...')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {t('email.export.exportCount', 'Export {{count}} contacts', { count: exportCount })}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ExportModal;

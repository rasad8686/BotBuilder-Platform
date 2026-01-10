import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, Check, AlertCircle,
  ChevronRight, ChevronLeft, X, RefreshCw
} from 'lucide-react';
import { useImportContactsMutation } from '../../hooks/email/useContacts';
import { useListsQuery } from '../../hooks/email/useLists';
import { parseCSV, autoMapColumns, validateImportData } from '../../utils/csvParser';
import CSVColumnMapper from '../../components/email/CSVColumnMapper';
import ImportProgressModal from '../../components/email/ImportProgressModal';
import ContactTagsInput from '../../components/email/ContactTagsInput';

const ContactImportPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Step state
  const [step, setStep] = useState(1);

  // Step 1: Upload
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Step 2: Mapping
  const [columnMapping, setColumnMapping] = useState({});

  // Step 3: Options
  const [importOptions, setImportOptions] = useState({
    duplicateAction: 'skip', // skip, update
    defaultStatus: 'subscribed',
    addToList: null,
    addTags: []
  });

  // Step 4: Review & Import
  const [validationResults, setValidationResults] = useState(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: 'idle' });

  // API
  const importMutation = useImportContactsMutation();
  const { data: listsData } = useListsQuery();
  const lists = listsData?.lists || [];

  // Contact fields for mapping
  const contactFields = [
    { id: 'email', label: t('email.import.fieldEmail', 'Email'), required: true },
    { id: 'first_name', label: t('email.import.fieldFirstName', 'First Name') },
    { id: 'last_name', label: t('email.import.fieldLastName', 'Last Name') },
    { id: 'phone', label: t('email.import.fieldPhone', 'Phone') },
    { id: 'company', label: t('email.import.fieldCompany', 'Company') },
    { id: 'job_title', label: t('email.import.fieldJobTitle', 'Job Title') },
    { id: 'tags', label: t('email.import.fieldTags', 'Tags') },
    { id: 'skip', label: t('email.import.skipColumn', 'Skip this column') }
  ];

  // Handle file upload
  const handleFileUpload = useCallback(async (uploadedFile) => {
    setUploadError(null);

    if (!uploadedFile) return;

    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const extension = uploadedFile.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(uploadedFile.type) && !['csv', 'xlsx', 'xls'].includes(extension)) {
      setUploadError(t('email.import.invalidFileType', 'Please upload a CSV or Excel file'));
      return;
    }

    try {
      const result = await parseCSV(uploadedFile);
      setFile(uploadedFile);
      setFileData(result);

      // Auto-map columns
      const autoMapping = autoMapColumns(result.headers);
      setColumnMapping(autoMapping);
    } catch (err) {
      setUploadError(err.message);
    }
  }, [t]);

  // Handle drag & drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileUpload(droppedFile);
  };

  // Download sample template
  const downloadTemplate = () => {
    const template = 'email,first_name,last_name,phone,company,job_title,tags\njohn@example.com,John,Doe,+1234567890,Acme Inc,CEO,"vip,customer"\njane@example.com,Jane,Smith,+0987654321,TechCorp,CTO,"lead,tech"';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Go to next step
  const nextStep = () => {
    if (step === 2) {
      // Validate mapping - email must be mapped
      const emailMapped = Object.values(columnMapping).includes('email');
      if (!emailMapped) {
        setUploadError(t('email.import.emailRequired', 'Email field must be mapped'));
        return;
      }
    }

    if (step === 3) {
      // Validate data
      const results = validateImportData(fileData.data, columnMapping);
      setValidationResults(results);
    }

    setStep(s => Math.min(4, s + 1));
    setUploadError(null);
  };

  // Go to previous step
  const prevStep = () => {
    setStep(s => Math.max(1, s - 1));
    setUploadError(null);
  };

  // Start import
  const startImport = async () => {
    setShowProgressModal(true);
    setImportProgress({ current: 0, total: validationResults.valid.length, status: 'importing' });

    try {
      const result = await importMutation.mutateAsync({
        data: validationResults.valid,
        mapping: columnMapping,
        options: importOptions,
        onProgress: (current, total) => {
          setImportProgress({ current, total, status: 'importing' });
        }
      });

      setImportProgress({
        current: result.imported,
        total: result.total,
        status: 'completed',
        ...result
      });
    } catch (err) {
      setImportProgress(prev => ({
        ...prev,
        status: 'error',
        error: err.message
      }));
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center transition-colors
                ${isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-slate-600 hover:border-blue-400'
                }
              `}
            >
              {file ? (
                <div>
                  <FileSpreadsheet className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {fileData?.data.length} {t('email.import.rowsFound', 'rows found')}
                  </p>
                  <button
                    onClick={() => {
                      setFile(null);
                      setFileData(null);
                      setColumnMapping({});
                    }}
                    className="text-sm text-red-600 hover:underline"
                  >
                    {t('email.import.removeFile', 'Remove file')}
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {t('email.import.dragDrop', 'Drag and drop your file here')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {t('email.import.or', 'or')}
                  </p>
                  <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                    {t('email.import.browse', 'Browse files')}
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => handleFileUpload(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                    {t('email.import.supportedFormats', 'Supported formats: CSV, Excel (.xlsx, .xls)')}
                  </p>
                </div>
              )}
            </div>

            {/* Sample Template */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {t('email.import.needTemplate', 'Need a template?')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('email.import.downloadTemplate', 'Download our sample CSV template')}
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t('email.import.download', 'Download')}
              </button>
            </div>

            {/* File Preview */}
            {fileData && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('email.import.preview', 'Preview')} ({t('email.import.first5Rows', 'first 5 rows')})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-slate-700">
                      <tr>
                        {fileData.headers.map((header, i) => (
                          <th key={i} className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                      {fileData.data.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {fileData.headers.map((header, j) => (
                            <td key={j} className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {row[header] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <p className="text-gray-600 dark:text-gray-400">
              {t('email.import.mapColumns', 'Map your CSV columns to contact fields. We\'ve auto-detected some mappings for you.')}
            </p>

            <CSVColumnMapper
              headers={fileData?.headers || []}
              mapping={columnMapping}
              onChange={setColumnMapping}
              fields={contactFields}
              sampleData={fileData?.data.slice(0, 3) || []}
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Duplicate Action */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('email.import.duplicateAction', 'What to do with existing contacts?')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="skip"
                    checked={importOptions.duplicateAction === 'skip'}
                    onChange={(e) => setImportOptions(prev => ({ ...prev, duplicateAction: e.target.value }))}
                    className="text-blue-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t('email.import.skipDuplicates', 'Skip duplicates')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('email.import.skipDuplicatesDesc', 'Existing contacts will not be modified')}
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="update"
                    checked={importOptions.duplicateAction === 'update'}
                    onChange={(e) => setImportOptions(prev => ({ ...prev, duplicateAction: e.target.value }))}
                    className="text-blue-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t('email.import.updateDuplicates', 'Update existing')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('email.import.updateDuplicatesDesc', 'Update existing contacts with new data')}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Default Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('email.import.defaultStatus', 'Default subscription status')}
              </label>
              <select
                value={importOptions.defaultStatus}
                onChange={(e) => setImportOptions(prev => ({ ...prev, defaultStatus: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              >
                <option value="subscribed">{t('email.import.subscribed', 'Subscribed')}</option>
                <option value="unsubscribed">{t('email.import.unsubscribed', 'Unsubscribed')}</option>
              </select>
            </div>

            {/* Add to List */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('email.import.addToList', 'Add to list (optional)')}
              </label>
              <select
                value={importOptions.addToList || ''}
                onChange={(e) => setImportOptions(prev => ({ ...prev, addToList: e.target.value || null }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              >
                <option value="">{t('email.import.noList', 'No list')}</option>
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </div>

            {/* Add Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('email.import.addTags', 'Add tags (optional)')}
              </label>
              <ContactTagsInput
                tags={importOptions.addTags}
                onChange={(tags) => setImportOptions(prev => ({ ...prev, addTags: tags }))}
                editable
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {validationResults?.valid.length || 0}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {t('email.import.validContacts', 'Valid contacts')}
                </p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {validationResults?.duplicates.length || 0}
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {t('email.import.duplicates', 'Duplicates')}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {validationResults?.invalid.length || 0}
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {t('email.import.invalidRows', 'Invalid rows')}
                </p>
              </div>
            </div>

            {/* Invalid Rows Details */}
            {validationResults?.invalid.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">
                  {t('email.import.invalidRowsDetails', 'Invalid rows details')}
                </h4>
                <div className="max-h-40 overflow-y-auto">
                  {validationResults.invalid.slice(0, 10).map((item, i) => (
                    <p key={i} className="text-sm text-red-600 dark:text-red-400">
                      {t('email.import.rowError', 'Row {{row}}: {{reason}}', { row: item.row, reason: item.reason })}
                    </p>
                  ))}
                  {validationResults.invalid.length > 10 && (
                    <p className="text-sm text-red-500 mt-2">
                      {t('email.import.moreErrors', '...and {{count}} more', { count: validationResults.invalid.length - 10 })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Import Options Summary */}
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                {t('email.import.importSettings', 'Import settings')}
              </h4>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{t('email.import.duplicateHandling', 'Duplicate handling')}:</span>{' '}
                  {importOptions.duplicateAction === 'skip' ? t('email.import.skip', 'Skip') : t('email.import.update', 'Update')}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{t('email.import.status', 'Status')}:</span>{' '}
                  {importOptions.defaultStatus}
                </p>
                {importOptions.addToList && (
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{t('email.import.list', 'List')}:</span>{' '}
                    {lists.find(l => l.id === importOptions.addToList)?.name}
                  </p>
                )}
                {importOptions.addTags.length > 0 && (
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{t('email.import.tags', 'Tags')}:</span>{' '}
                    {importOptions.addTags.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/email/contacts')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('email.import.backToContacts', 'Back to Contacts')}
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('email.import.title', 'Import Contacts')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {t('email.import.subtitle', 'Import contacts from a CSV or Excel file')}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((s) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step >= s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                  }
                `}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                <span className={`text-sm hidden sm:inline ${
                  step >= s ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {s === 1 && t('email.import.step1', 'Upload')}
                  {s === 2 && t('email.import.step2', 'Mapping')}
                  {s === 3 && t('email.import.step3', 'Options')}
                  {s === 4 && t('email.import.step4', 'Review')}
                </span>
              </div>
              {s < 4 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  step > s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
          {/* Error */}
          {uploadError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-600 dark:text-red-400">{uploadError}</p>
              <button
                onClick={() => setUploadError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {renderStepContent()}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={prevStep}
              disabled={step === 1}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('email.import.back', 'Back')}
            </button>

            {step < 4 ? (
              <motion.button
                onClick={nextStep}
                disabled={step === 1 && !file}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {t('email.import.next', 'Next')}
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            ) : (
              <motion.button
                onClick={startImport}
                disabled={!validationResults?.valid.length}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Upload className="w-4 h-4" />
                {t('email.import.startImport', 'Start Import')}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      <AnimatePresence>
        {showProgressModal && (
          <ImportProgressModal
            progress={importProgress}
            onClose={() => {
              setShowProgressModal(false);
              if (importProgress.status === 'completed') {
                navigate('/email/contacts');
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContactImportPage;

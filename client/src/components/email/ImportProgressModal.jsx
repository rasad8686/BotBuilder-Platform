import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Check, AlertCircle, RefreshCw, Upload } from 'lucide-react';

const ImportProgressModal = ({ progress, onClose }) => {
  const { t } = useTranslation();

  const percentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {progress.status === 'completed'
              ? t('email.import.completed', 'Import Completed')
              : progress.status === 'error'
                ? t('email.import.error', 'Import Error')
                : t('email.import.importing', 'Importing Contacts')
            }
          </h2>
          {(progress.status === 'completed' || progress.status === 'error') && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Status Icon */}
        <div className="flex justify-center mb-6">
          {progress.status === 'completed' ? (
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          ) : progress.status === 'error' ? (
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
            </div>
          )}
        </div>

        {/* Progress bar */}
        {progress.status === 'importing' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('email.import.processing', 'Processing row {{current}} of {{total}}', {
                  current: progress.current,
                  total: progress.total
                })}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {percentage}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {progress.status === 'completed' && (
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-sm text-green-700 dark:text-green-400">
                {t('email.import.imported', 'Imported')}
              </span>
              <span className="font-semibold text-green-700 dark:text-green-400">
                {progress.imported || progress.current}
              </span>
            </div>

            {progress.updated > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-sm text-blue-700 dark:text-blue-400">
                  {t('email.import.updated', 'Updated')}
                </span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  {progress.updated}
                </span>
              </div>
            )}

            {progress.skipped > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <span className="text-sm text-yellow-700 dark:text-yellow-400">
                  {t('email.import.skipped', 'Skipped (duplicates)')}
                </span>
                <span className="font-semibold text-yellow-700 dark:text-yellow-400">
                  {progress.skipped}
                </span>
              </div>
            )}

            {progress.failed > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-sm text-red-700 dark:text-red-400">
                  {t('email.import.failed', 'Failed')}
                </span>
                <span className="font-semibold text-red-700 dark:text-red-400">
                  {progress.failed}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {progress.status === 'error' && progress.error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-6">
            <p className="text-sm text-red-700 dark:text-red-400">
              {progress.error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {progress.status === 'importing' ? (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              {t('email.import.cancel', 'Cancel')}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {progress.status === 'completed'
                ? t('email.import.viewContacts', 'View Contacts')
                : t('email.import.close', 'Close')
              }
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ImportProgressModal;

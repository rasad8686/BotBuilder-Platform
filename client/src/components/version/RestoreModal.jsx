import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function RestoreModal({ entityType, entityId, version, onClose, onRestored }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [commitMessage, setCommitMessage] = useState(`Restored to version ${version.version_number}`);
  const inputRef = useRef(null);

  const token = localStorage.getItem('token');

  // Focus and keyboard handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    if (inputRef.current) {
      inputRef.current.focus();
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRestore = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/versions/${entityType}/${entityId}/rollback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetVersion: version.version_number,
          commitMessage
        })
      });

      if (res.ok) {
        onRestored();
      } else {
        const data = await res.json();
        setError(data.error || t('version.restoreFailed', 'Failed to restore version'));
      }
    } catch (err) {
      setError(t('common.networkError', 'Network error. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl p-8 w-full max-w-lg shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 id="restore-modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('version.restoreVersion', 'Restore Version')}
            </h2>
            <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">
              {t('version.restoreDescription', 'This will create a new version with the content from version')} {version.version_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={t('common.close', 'Close modal')}
          >
            &times;
          </button>
        </div>

        {/* Version Preview */}
        <div className="p-5 bg-gray-50 dark:bg-slate-700 rounded-xl mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-amber-500 text-white flex flex-col items-center justify-center flex-shrink-0">
              <div className="text-xs opacity-80">v</div>
              <div className="text-xl font-bold">{version.version_number}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white mb-1">
                {version.commit_message || `Version ${version.version_number}`}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {t('version.by', 'by')} <strong>{version.created_by_name || 'Unknown'}</strong>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(version.created_at)}
              </div>
            </div>
          </div>
        </div>

        {/* Data Preview */}
        {version.data && (
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700 dark:text-gray-200 text-sm">
              {t('version.dataPreview', 'Version Data Preview')}
            </label>
            <div className="p-3 bg-gray-100 dark:bg-slate-900 rounded-lg max-h-36 overflow-auto font-mono text-xs text-gray-600 dark:text-gray-300">
              {JSON.stringify(version.data, null, 2).slice(0, 500)}
              {JSON.stringify(version.data).length > 500 && '...'}
            </div>
          </div>
        )}

        {/* Commit Message */}
        <div className="mb-6">
          <label className="block mb-2 font-medium text-gray-700 dark:text-gray-200">
            {t('version.commitMessage', 'Commit Message')}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full px-4 py-3 min-h-[44px] rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800 outline-none transition-all text-sm"
          />
        </div>

        {/* Warning */}
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg mb-6 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <strong>{t('common.important', 'Important')}:</strong> {t('version.restoreWarning', 'Restoring will not delete any versions. A new version will be created with the restored content.')}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 mb-5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-lg text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 min-h-[44px] bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleRestore}
            disabled={loading}
            className="flex-1 px-5 py-3 min-h-[44px] bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? t('version.restoring', 'Restoring...') : t('version.restoreVersion', 'Restore Version')}
          </button>
        </div>
      </div>
    </div>
  );
}

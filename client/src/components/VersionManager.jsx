/**
 * Version Manager Component
 *
 * Manages model versions:
 * - Version list (timeline view)
 * - Create new version
 * - Set active/production version
 * - Rollback functionality
 * - Version comparison
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitBranch,
  Plus,
  Check,
  Rocket,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Star,
  Loader2,
  AlertCircle,
  XCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function VersionManager({ models }) {
  const { t } = useTranslation();
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedVersionId, setExpandedVersionId] = useState(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    version_number: ''
  });
  const [creating, setCreating] = useState(false);

  const token = localStorage.getItem('token');

  // Fetch versions for selected model
  const fetchVersions = useCallback(async () => {
    if (!selectedModelId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${selectedModelId}/versions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        setVersions(data.versions || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedModelId, token]);

  useEffect(() => {
    if (selectedModelId) {
      fetchVersions();
    }
  }, [selectedModelId, fetchVersions]);

  // Create new version
  const handleCreateVersion = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${selectedModelId}/versions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        setVersions(prev => [data.version, ...prev]);
        setShowCreateModal(false);
        setFormData({ description: '', version_number: '' });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Set active version
  const handleSetActive = async (versionId) => {
    try {
      const res = await fetch(
        `${API_URL}/api/fine-tuning/models/${selectedModelId}/versions/${versionId}/activate`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await res.json();
      if (data.success) {
        setVersions(prev => prev.map(v => ({
          ...v,
          is_active: v.id === versionId
        })));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Set production version
  const handleSetProduction = async (versionId) => {
    try {
      const res = await fetch(
        `${API_URL}/api/fine-tuning/models/${selectedModelId}/versions/${versionId}/set-production`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await res.json();
      if (data.success) {
        setVersions(prev => prev.map(v => ({
          ...v,
          is_production: v.id === versionId
        })));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Rollback to version
  const handleRollback = async (versionId) => {
    if (!confirm(t('versions.confirmRollback', 'Are you sure you want to rollback to this version?'))) return;

    try {
      const res = await fetch(
        `${API_URL}/api/fine-tuning/models/${selectedModelId}/versions/${versionId}/rollback`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await res.json();
      if (data.success) {
        fetchVersions();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete version
  const handleDelete = async (versionId) => {
    if (!confirm(t('versions.confirmDelete', 'Are you sure you want to delete this version?'))) return;

    try {
      const res = await fetch(
        `${API_URL}/api/fine-tuning/models/${selectedModelId}/versions/${versionId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await res.json();
      if (data.success) {
        setVersions(prev => prev.filter(v => v.id !== versionId));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const completedModels = models.filter(m => m.status === 'completed');

  return (
    <div className="version-manager">
      {/* Model Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('versions.selectModel', 'Select Model')}
        </label>
        <select
          value={selectedModelId || ''}
          onChange={(e) => setSelectedModelId(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
        >
          <option value="">{t('versions.chooseModel', 'Choose a model...')}</option>
          {models.map(model => (
            <option
              key={model.id}
              value={model.id}
              disabled={model.status !== 'completed'}
            >
              {model.name} ({model.base_model}) {model.status !== 'completed' ? `- ${model.status}` : ''}
            </option>
          ))}
        </select>
        {models.length > 0 && completedModels.length === 0 && (
          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
            {t('versions.noCompletedModels', 'No completed models yet. Train a model first to manage versions.')}
          </p>
        )}
        {models.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t('versions.noModels', 'No models found. Create a model first.')}
          </p>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {selectedModelId && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('versions.title', 'Model Versions')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {versions.length} {t('versions.versionsCount', 'versions')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('versions.newVersion', 'New Version')}
            </button>
          </div>

          {/* Version Timeline */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
              <GitBranch className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {t('versions.noVersions', 'No versions yet. Create your first version.')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
                >
                  {/* Version Header */}
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700"
                    onClick={() => setExpandedVersionId(
                      expandedVersionId === version.id ? null : version.id
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {/* Timeline Indicator */}
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          version.is_production
                            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                            : version.is_active
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
                        }`}>
                          {version.is_production ? (
                            <Rocket className="w-5 h-5" />
                          ) : version.is_active ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <GitBranch className="w-5 h-5" />
                          )}
                        </div>
                        {index < versions.length - 1 && (
                          <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-8 bg-gray-200 dark:bg-slate-600" />
                        )}
                      </div>

                      {/* Version Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {version.version_number}
                          </span>
                          {version.is_production && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                              Production
                            </span>
                          )}
                          {version.is_active && !version.is_production && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(version.created_at)}
                          </span>
                          {version.performance_score && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-500" />
                              {version.performance_score}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expand Icon */}
                    {expandedVersionId === version.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Expanded Content */}
                  {expandedVersionId === version.id && (
                    <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700">
                      <div className="pt-4 space-y-4">
                        {/* Description */}
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {t('versions.description', 'Description')}
                          </label>
                          <p className="text-gray-900 dark:text-white">
                            {version.description || t('versions.noDescription', 'No description')}
                          </p>
                        </div>

                        {/* OpenAI Model ID */}
                        {version.openai_model_id && (
                          <div>
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              {t('versions.openaiId', 'OpenAI Model ID')}
                            </label>
                            <p className="font-mono text-sm text-purple-600 dark:text-purple-400">
                              {version.openai_model_id}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2">
                          {!version.is_active && (
                            <button
                              onClick={() => handleSetActive(version.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                            >
                              <Check className="w-4 h-4" />
                              {t('versions.setActive', 'Set Active')}
                            </button>
                          )}
                          {!version.is_production && (
                            <button
                              onClick={() => handleSetProduction(version.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50"
                            >
                              <Rocket className="w-4 h-4" />
                              {t('versions.setProduction', 'Set Production')}
                            </button>
                          )}
                          <button
                            onClick={() => handleRollback(version.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                          >
                            <RotateCcw className="w-4 h-4" />
                            {t('versions.rollback', 'Rollback')}
                          </button>
                          {!version.is_active && !version.is_production && versions.length > 1 && (
                            <button
                              onClick={() => handleDelete(version.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"
                            >
                              <Trash2 className="w-4 h-4" />
                              {t('versions.delete', 'Delete')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Version Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('versions.createVersion', 'Create New Version')}
              </h2>
            </div>
            <form onSubmit={handleCreateVersion} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('versions.versionNumber', 'Version Number')} ({t('common.optional', 'optional')})
                </label>
                <input
                  type="text"
                  value={formData.version_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, version_number: e.target.value }))}
                  placeholder="v1.0"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('versions.versionHint', 'Leave empty for auto-increment')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('versions.description', 'Description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('versions.descriptionPlaceholder', 'What changed in this version?')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('versions.create', 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Brain,
  Plus,
  Upload,
  Play,
  Square,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText,
  Settings,
  BarChart3,
  AlertCircle,
  TrendingUp,
  Calendar,
  GitBranch,
  FlaskConical
} from 'lucide-react';
import MetricsDashboard from '../components/MetricsDashboard';
import VersionManager from '../components/VersionManager';
import ABTestManager from '../components/ABTestManager';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const statusColors = {
  pending: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', icon: Clock },
  uploading: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-600 dark:text-blue-300', icon: Upload },
  validating: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-600 dark:text-yellow-300', icon: RefreshCw },
  training: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-600 dark:text-purple-300', icon: Loader2 },
  completed: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-600 dark:text-green-300', icon: CheckCircle },
  failed: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-600 dark:text-red-300', icon: XCircle },
  cancelled: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400', icon: Square }
};

export default function FineTuning() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('models');
  const [models, setModels] = useState([]);
  const [baseModels, setBaseModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTrainModal, setShowTrainModal] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_model: 'gpt-3.5-turbo'
  });
  const [trainingConfig, setTrainingConfig] = useState({
    epochs: 3,
    batch_size: 1,
    learning_rate: 0.0001
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [training, setTraining] = useState(false);

  const token = localStorage.getItem('token');

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setModels(data.models || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchBaseModels = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/base-models`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBaseModels(data.models || []);
      }
    } catch (err) {
      console.error('Error fetching base models:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchModels();
    fetchBaseModels();

    // Poll for status updates every 10 seconds
    const interval = setInterval(fetchModels, 10000);
    return () => clearInterval(interval);
  }, [fetchModels, fetchBaseModels]);

  const handleCreateModel = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        setModels(prev => [data.model, ...prev]);
        setShowCreateModal(false);
        setFormData({ name: '', description: '', base_model: 'gpt-3.5-turbo' });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUploadDataset = async (e) => {
    e.preventDefault();
    if (!uploadFile || !selectedModel) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${selectedModel.id}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        setShowUploadModal(false);
        setUploadFile(null);
        fetchModels();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleStartTraining = async (e) => {
    e.preventDefault();
    if (!selectedModel) return;

    setTraining(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${selectedModel.id}/train`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(trainingConfig)
      });

      const data = await res.json();
      if (data.success) {
        setShowTrainModal(false);
        fetchModels();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTraining(false);
    }
  };

  const handleCancelTraining = async (modelId) => {
    if (!confirm(t('fineTuning.confirmCancel'))) return;

    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${modelId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        fetchModels();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteModel = async (modelId) => {
    if (!confirm(t('fineTuning.confirmDelete'))) return;

    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${modelId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        setModels(prev => prev.filter(m => m.id !== modelId));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const openUploadModal = (model) => {
    setSelectedModel(model);
    setShowUploadModal(true);
  };

  const openTrainModal = (model) => {
    setSelectedModel(model);
    setShowTrainModal(true);
  };

  const openMetricsModal = (model) => {
    setSelectedModel(model);
    setShowMetricsModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  const StatusBadge = ({ status }) => {
    const config = statusColors[status] || statusColors.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className={`w-3.5 h-3.5 ${status === 'training' ? 'animate-spin' : ''}`} />
        {t(`fineTuning.status.${status}`)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl">
              <Brain className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('fineTuning.title')}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                {t('fineTuning.subtitle')}
              </p>
            </div>
          </div>
          {activeTab === 'models' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('fineTuning.newModel')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-slate-700">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'models'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Brain className="w-4 h-4" />
            {t('fineTuning.tabs.models', 'Models')}
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'versions'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            {t('fineTuning.tabs.versions', 'Versions')}
          </button>
          <button
            onClick={() => setActiveTab('abTests')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'abTests'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            {t('fineTuning.tabs.abTests', 'A/B Tests')}
          </button>
        </div>
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

      {/* Tab Content */}
      {activeTab === 'models' && (
        <>
          {/* Models Grid */}
          {models.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700">
              <Brain className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('fineTuning.noModels')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {t('fineTuning.noModelsDesc')}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-5 h-5" />
                {t('fineTuning.createFirst')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map((model) => (
            <div
              key={model.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {model.name}
                  </h3>
                  <StatusBadge status={model.status} />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {model.description || t('fineTuning.noDescription')}
                </p>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{t('fineTuning.baseModel')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{model.base_model}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{t('fineTuning.datasets')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{model.dataset_count || 0}</span>
                </div>

                {model.model_id && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{t('fineTuning.fineTunedId')}</span>
                    <span className="font-mono text-xs text-purple-600 dark:text-purple-400 truncate max-w-[150px]">
                      {model.model_id}
                    </span>
                  </div>
                )}

                {/* Last trained date */}
                {model.training_completed_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {t('fineTuning.lastTrained', 'Last Trained')}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDate(model.training_completed_at)}
                    </span>
                  </div>
                )}

                {/* Metrics preview */}
                {model.metrics && Object.keys(model.metrics).length > 0 && (
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-4 text-sm">
                      {model.metrics.accuracy && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-gray-500 dark:text-gray-400">{t('fineTuning.accuracy')}: </span>
                          <span className="font-medium text-green-600">{(model.metrics.accuracy * 100).toFixed(1)}%</span>
                        </div>
                      )}
                      {model.metrics.loss && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">{t('fineTuning.loss')}: </span>
                          <span className="font-medium text-gray-900 dark:text-white">{model.metrics.loss.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  {model.status === 'pending' && (
                    <>
                      <button
                        onClick={() => openUploadModal(model)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                      >
                        <Upload className="w-4 h-4" />
                        {t('fineTuning.upload')}
                      </button>
                      <button
                        onClick={() => openTrainModal(model)}
                        disabled={!model.dataset_count}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-4 h-4" />
                        {t('fineTuning.train')}
                      </button>
                    </>
                  )}

                  {model.status === 'training' && (
                    <button
                      onClick={() => handleCancelTraining(model.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"
                    >
                      <Square className="w-4 h-4" />
                      {t('fineTuning.cancel')}
                    </button>
                  )}

                  {['completed', 'failed', 'cancelled'].includes(model.status) && (
                    <>
                      {model.status === 'completed' && (
                        <button
                          onClick={() => openMetricsModal(model)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50"
                        >
                          <BarChart3 className="w-4 h-4" />
                          {t('fineTuning.viewMetrics', 'Metrics')}
                        </button>
                      )}
                      <button
                        onClick={() => openUploadModal(model)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('fineTuning.retrain')}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => handleDeleteModel(model.id)}
                    disabled={model.status === 'training'}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
          )}
        </>
      )}

      {/* Versions Tab */}
      {activeTab === 'versions' && (
        <VersionManager models={models} />
      )}

      {/* A/B Tests Tab */}
      {activeTab === 'abTests' && (
        <ABTestManager models={models} />
      )}

      {/* Create Model Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('fineTuning.createModel')}
              </h2>
            </div>
            <form onSubmit={handleCreateModel} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('fineTuning.modelName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('fineTuning.modelNamePlaceholder')}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('fineTuning.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('fineTuning.descriptionPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('fineTuning.baseModel')}
                </label>
                <select
                  value={formData.base_model}
                  onChange={(e) => setFormData(prev => ({ ...prev, base_model: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {baseModels.filter(m => m.available !== false).map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
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
                  disabled={creating || !formData.name}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('fineTuning.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Dataset Modal */}
      {showUploadModal && selectedModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('fineTuning.uploadDataset')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('fineTuning.uploadFor')} "{selectedModel.name}"
              </p>
            </div>
            <form onSubmit={handleUploadDataset} className="p-6 space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  uploadFile
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-purple-500'
                }`}
              >
                <input
                  type="file"
                  accept=".jsonl,.json,.csv"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="hidden"
                  id="dataset-upload"
                />
                <label htmlFor="dataset-upload" className="cursor-pointer">
                  {uploadFile ? (
                    <>
                      <FileText className="w-12 h-12 mx-auto text-purple-500 mb-3" />
                      <p className="font-medium text-gray-900 dark:text-white">{uploadFile.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(uploadFile.size / 1024).toFixed(1)} KB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="font-medium text-gray-900 dark:text-white">
                        {t('fineTuning.dropzone')}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('fineTuning.supportedFormats')}
                      </p>
                    </>
                  )}
                </label>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                  {t('fineTuning.dataFormat')}
                </h4>
                <pre className="text-xs text-blue-700 dark:text-blue-400 overflow-x-auto">
{`{"messages": [
  {"role": "system", "content": "You are..."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi!"}
]}`}
                </pre>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); setUploadFile(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('fineTuning.uploadBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Training Config Modal */}
      {showTrainModal && selectedModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('fineTuning.startTraining')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('fineTuning.configureFor')} "{selectedModel.name}"
              </p>
            </div>
            <form onSubmit={handleStartTraining} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('fineTuning.epochs')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={trainingConfig.epochs}
                  onChange={(e) => setTrainingConfig(prev => ({ ...prev, epochs: parseInt(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('fineTuning.epochsDesc')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('fineTuning.batchSize')}
                </label>
                <select
                  value={trainingConfig.batch_size}
                  onChange={(e) => setTrainingConfig(prev => ({ ...prev, batch_size: parseInt(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('fineTuning.learningRate')}
                </label>
                <select
                  value={trainingConfig.learning_rate}
                  onChange={(e) => setTrainingConfig(prev => ({ ...prev, learning_rate: parseFloat(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value={0.0001}>0.0001 (Default)</option>
                  <option value={0.00005}>0.00005 (Lower)</option>
                  <option value={0.0002}>0.0002 (Higher)</option>
                </select>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {t('fineTuning.trainingWarning')}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTrainModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={training}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {training && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Play className="w-4 h-4" />
                  {t('fineTuning.startBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Metrics Dashboard Modal */}
      {showMetricsModal && selectedModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-auto shadow-2xl">
            <MetricsDashboard
              modelId={selectedModel.id}
              onClose={() => setShowMetricsModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

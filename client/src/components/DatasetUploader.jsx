/**
 * Dataset Uploader Component
 *
 * Features:
 * - Drag & Drop zone
 * - File format selection (JSONL, CSV, JSON)
 * - Upload progress bar
 * - Preview table (first 10 rows)
 * - Validation status
 * - Token count display
 * - Estimated cost display
 * - Convert to JSONL button
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Eye,
  FileJson,
  X,
  DollarSign,
  Hash
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function DatasetUploader({ modelId, onUploadComplete, onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const token = localStorage.getItem('token');

  // States
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDataset, setUploadedDataset] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState(null);

  // Allowed file types
  const allowedTypes = ['.jsonl', '.json', '.csv', '.txt'];

  // Handle drag events
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validate file type and set
  const validateAndSetFile = (selectedFile) => {
    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
      setError(t('datasetUploader.invalidFormat', 'Invalid file format. Allowed: JSONL, JSON, CSV, TXT'));
      return;
    }

    setFile(selectedFile);
    setError(null);
    setPreview(null);
    setUploadedDataset(null);
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate progress (since fetch doesn't support progress natively)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const res = await fetch(`${API_URL}/api/fine-tuning/models/${modelId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();

      if (data.success) {
        setUploadedDataset(data.dataset);
        // Fetch preview after short delay to allow validation
        setTimeout(() => {
          fetchPreview(data.dataset.id);
        }, 1000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Fetch dataset preview
  const fetchPreview = async (datasetId) => {
    setLoading(true);

    try {
      const res = await fetch(
        `${API_URL}/api/fine-tuning/models/${modelId}/datasets/${datasetId}/preview`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await res.json();

      if (data.success) {
        setPreview(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Convert to JSONL
  const handleConvert = async () => {
    if (!uploadedDataset) return;

    setConverting(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/api/fine-tuning/models/${modelId}/datasets/${uploadedDataset.id}/convert`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await res.json();

      if (data.success) {
        // Refresh preview
        fetchPreview(uploadedDataset.id);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setConverting(false);
    }
  };

  // Complete upload
  const handleComplete = () => {
    if (onUploadComplete) {
      onUploadComplete(uploadedDataset);
    }
    if (onClose) {
      onClose();
    }
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file extension
  const getFileExtension = (fileName) => {
    return fileName ? '.' + fileName.split('.').pop().toLowerCase() : '';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('datasetUploader.title', 'Upload Training Dataset')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('datasetUploader.subtitle', 'Upload your training data in JSONL, JSON, or CSV format')}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Drag & Drop Zone */}
          {!uploadedDataset && (
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : file
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-slate-600 hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jsonl,.json,.csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <>
                  <FileText className="w-12 h-12 mx-auto text-green-500 mb-3" />
                  <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {formatSize(file.size)} • {getFileExtension(file.name).toUpperCase().replace('.', '')}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="mt-3 text-sm text-red-500 hover:text-red-700"
                  >
                    {t('common.remove', 'Remove')}
                  </button>
                </>
              ) : (
                <>
                  <Upload className={`w-12 h-12 mx-auto mb-3 ${isDragging ? 'text-purple-500' : 'text-gray-400'}`} />
                  <p className="font-medium text-gray-900 dark:text-white">
                    {t('datasetUploader.dropzone', 'Drag and drop your file here, or click to browse')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('datasetUploader.supportedFormats', 'Supported formats: JSONL, JSON, CSV, TXT (max 100MB)')}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('datasetUploader.uploading', 'Uploading...')}
                </span>
                <span className="text-sm font-medium text-purple-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Preview Section */}
          {uploadedDataset && (
            <div className="mt-6 space-y-6">
              {/* Dataset Info */}
              <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <FileJson className="w-8 h-8 text-purple-500" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{uploadedDataset.file_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatSize(uploadedDataset.file_size)} • {uploadedDataset.format?.toUpperCase()}
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                    <span className="ml-2 text-gray-500">{t('common.loading', 'Loading...')}</span>
                  </div>
                ) : preview ? (
                  <div className="space-y-4">
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('datasetUploader.totalRows', 'Total Rows')}</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{preview.total_rows}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('datasetUploader.validRows', 'Valid Rows')}</p>
                        <p className="text-lg font-semibold text-green-600">{preview.valid_rows}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Hash className="w-3 h-3" />
                          {t('datasetUploader.tokens', 'Tokens')}
                        </div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{preview.token_count?.toLocaleString()}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <DollarSign className="w-3 h-3" />
                          {t('datasetUploader.estimatedCost', 'Est. Cost')}
                        </div>
                        <p className="text-lg font-semibold text-purple-600">{preview.estimated_cost}</p>
                      </div>
                    </div>

                    {/* Validation Status */}
                    <div className={`p-3 rounded-lg flex items-center gap-2 ${
                      preview.format_valid
                        ? 'bg-green-50 dark:bg-green-900/30'
                        : 'bg-red-50 dark:bg-red-900/30'
                    }`}>
                      {preview.format_valid ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-green-700 dark:text-green-300">
                            {t('datasetUploader.validFormat', 'Valid format - Ready for training')}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-500" />
                          <span className="text-red-700 dark:text-red-300">
                            {t('datasetUploader.invalidFormatDetected', 'Validation errors detected')}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Errors List */}
                    {preview.errors && preview.errors.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                        <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                          {t('datasetUploader.errors', 'Errors')} ({preview.errors.length})
                        </p>
                        <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                          {preview.errors.slice(0, 10).map((err, idx) => (
                            <li key={idx}>
                              {err.line ? `Line ${err.line}: ` : ''}{err.error}
                            </li>
                          ))}
                          {preview.errors.length > 10 && (
                            <li className="text-gray-500">...and {preview.errors.length - 10} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Preview Table */}
                    {preview.preview && preview.preview.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('datasetUploader.preview', 'Preview')} ({t('datasetUploader.firstRows', 'first 10 rows')})
                        </p>
                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                          <div className="overflow-x-auto max-h-64">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">#</th>
                                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">System</th>
                                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">User</th>
                                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">Assistant</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                {preview.preview.map((row, idx) => {
                                  const messages = row.data?.messages || [];
                                  const system = messages.find(m => m.role === 'system')?.content || '-';
                                  const user = messages.find(m => m.role === 'user')?.content || '-';
                                  const assistant = messages.find(m => m.role === 'assistant')?.content || '-';

                                  return (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-900">
                                      <td className="px-3 py-2 text-gray-500">{row.line}</td>
                                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={system}>
                                        {system.substring(0, 50)}{system.length > 50 ? '...' : ''}
                                      </td>
                                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={user}>
                                        {user.substring(0, 50)}{user.length > 50 ? '...' : ''}
                                      </td>
                                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={assistant}>
                                        {assistant.substring(0, 50)}{assistant.length > 50 ? '...' : ''}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Convert Button (for non-JSONL files) */}
                    {uploadedDataset.format !== 'jsonl' && (
                      <button
                        onClick={handleConvert}
                        disabled={converting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50"
                      >
                        {converting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        {t('datasetUploader.convertToJSONL', 'Convert to JSONL')}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Format Info */}
          {!uploadedDataset && (
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                {t('datasetUploader.expectedFormat', 'Expected Format (JSONL)')}
              </h4>
              <pre className="text-xs text-blue-700 dark:text-blue-400 overflow-x-auto bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
{`{"messages": [
  {"role": "system", "content": "You are a helpful assistant."},
  {"role": "user", "content": "Hello, how are you?"},
  {"role": "assistant", "content": "I'm doing great, thank you!"}
]}`}
              </pre>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                {t('datasetUploader.csvHint', 'For CSV: include columns named "system", "user", and "assistant" (or "prompt" and "completion")')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          )}

          {!uploadedDataset ? (
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('datasetUploader.uploading', 'Uploading...')}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {t('datasetUploader.upload', 'Upload Dataset')}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={loading || !preview?.format_valid}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {t('datasetUploader.done', 'Done')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

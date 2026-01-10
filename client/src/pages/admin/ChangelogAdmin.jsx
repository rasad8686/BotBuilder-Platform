/**
 * Changelog Admin Page
 *
 * Admin interface for managing changelog entries:
 * - CRUD interface
 * - Markdown editor for description
 * - Multi-item entry builder
 * - Preview before publish
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../api/axios';

// Type options
const TYPE_OPTIONS = [
  { value: 'feature', label: 'New Feature', color: 'bg-green-100 text-green-700' },
  { value: 'improvement', label: 'Improvement', color: 'bg-blue-100 text-blue-700' },
  { value: 'bugfix', label: 'Bug Fix', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'breaking', label: 'Breaking Change', color: 'bg-red-100 text-red-700' },
  { value: 'security', label: 'Security', color: 'bg-purple-100 text-purple-700' },
  { value: 'deprecated', label: 'Deprecated', color: 'bg-gray-100 text-gray-700' }
];

const CATEGORY_OPTIONS = [
  { value: 'api', label: 'API' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'sdk', label: 'SDK' },
  { value: 'billing', label: 'Billing' },
  { value: 'security', label: 'Security' }
];

export default function ChangelogAdmin() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // State
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    version: '',
    title: '',
    description: '',
    type: '',
    category: '',
    isBreaking: false,
    items: [{ content: '', apiEndpoint: '' }]
  });

  /**
   * Load changelog entries
   */
  const loadEntries = async (page = 1) => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosInstance.get(`/api/changelog/admin/list?page=${page}&limit=20`);

      if (response.data.success) {
        setEntries(response.data.data.entries);
        setPagination(response.data.data.pagination);
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  /**
   * Reset form
   */
  const resetForm = () => {
    setFormData({
      version: '',
      title: '',
      description: '',
      type: '',
      category: '',
      isBreaking: false,
      items: [{ content: '', apiEndpoint: '' }]
    });
    setEditingEntry(null);
    setShowPreview(false);
  };

  /**
   * Open editor for new entry
   */
  const handleNewEntry = () => {
    resetForm();
    setShowEditor(true);
  };

  /**
   * Open editor for editing
   */
  const handleEdit = (entry) => {
    setFormData({
      version: entry.version,
      title: entry.title,
      description: entry.description || '',
      type: entry.type || '',
      category: entry.category || '',
      isBreaking: entry.is_breaking || false,
      items: entry.items && entry.items.length > 0
        ? entry.items.map(item => ({ content: item.content, apiEndpoint: item.api_endpoint || '' }))
        : [{ content: '', apiEndpoint: '' }]
    });
    setEditingEntry(entry);
    setShowEditor(true);
  };

  /**
   * Add item to form
   */
  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { content: '', apiEndpoint: '' }]
    }));
  };

  /**
   * Remove item from form
   */
  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  /**
   * Update item
   */
  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  /**
   * Save entry
   */
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        version: formData.version,
        title: formData.title,
        description: formData.description || null,
        type: formData.type || null,
        category: formData.category || null,
        isBreaking: formData.isBreaking,
        items: formData.items.filter(item => item.content.trim())
      };

      let response;
      if (editingEntry) {
        response = await axiosInstance.put(`/api/changelog/admin/${editingEntry.id}`, payload);
      } else {
        response = await axiosInstance.post('/api/changelog/admin', payload);
      }

      if (response.data.success) {
        setSuccess(editingEntry ? 'Entry updated successfully' : 'Entry created successfully');
        setShowEditor(false);
        resetForm();
        await loadEntries(pagination.page);
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Delete entry
   */
  const handleDelete = async (entry) => {
    if (!confirm(`Are you sure you want to delete version ${entry.version}?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await axiosInstance.delete(`/api/changelog/admin/${entry.id}`);

      if (response.data.success) {
        setSuccess('Entry deleted successfully');
        await loadEntries(pagination.page);
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete entry');
    }
  };

  /**
   * Publish entry
   */
  const handlePublish = async (entry) => {
    setError('');
    setSuccess('');

    try {
      const response = await axiosInstance.post(`/api/changelog/admin/${entry.id}/publish`);

      if (response.data.success) {
        setSuccess(`Version ${entry.version} published successfully`);
        await loadEntries(pagination.page);
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish entry');
    }
  };

  /**
   * Unpublish entry
   */
  const handleUnpublish = async (entry) => {
    setError('');
    setSuccess('');

    try {
      const response = await axiosInstance.post(`/api/changelog/admin/${entry.id}/unpublish`);

      if (response.data.success) {
        setSuccess(`Version ${entry.version} unpublished`);
        await loadEntries(pagination.page);
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unpublish entry');
    }
  };

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isFormValid = formData.version && formData.title;

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              Changelog Admin
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage changelog entries and release notes
            </p>
          </div>
          <button
            onClick={handleNewEntry}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            + New Entry
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
            {success}
          </div>
        )}

        {/* Entries List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Version</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Created</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No changelog entries yet
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <code className="text-sm font-mono text-purple-600 dark:text-purple-400">
                          v{entry.version}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-800 dark:text-gray-200">{entry.title}</span>
                          {entry.is_breaking && (
                            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded">
                              Breaking
                            </span>
                          )}
                        </div>
                        {entry.items && entry.items.length > 0 && (
                          <span className="text-xs text-gray-400">
                            {entry.items.length} item{entry.items.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.type && (
                          <span className={`px-2 py-1 text-xs rounded ${TYPE_OPTIONS.find(t => t.value === entry.type)?.color || 'bg-gray-100 text-gray-700'}`}>
                            {TYPE_OPTIONS.find(t => t.value === entry.type)?.label || entry.type}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.is_published ? (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                            Published
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(entry)}
                            className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-sm"
                          >
                            Edit
                          </button>
                          {entry.is_published ? (
                            <button
                              onClick={() => handleUnpublish(entry)}
                              className="px-2 py-1 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded text-sm"
                            >
                              Unpublish
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePublish(entry)}
                              className="px-2 py-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-sm"
                            >
                              Publish
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(entry)}
                            className="px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t dark:border-slate-700 flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {pagination.total} entries total
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadEntries(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border dark:border-slate-600 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => loadEntries(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1 border dark:border-slate-600 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingEntry ? `Edit v${editingEntry.version}` : 'New Changelog Entry'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`px-3 py-1 rounded text-sm ${showPreview ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'}`}
                >
                  {showPreview ? 'Edit' : 'Preview'}
                </button>
                <button
                  onClick={() => { setShowEditor(false); resetForm(); }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  X
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {showPreview ? (
                /* Preview Mode */
                <div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-mono rounded">
                      v{formData.version || '0.0.0'}
                    </span>
                    {formData.type && (
                      <span className={`px-2 py-1 text-sm rounded ${TYPE_OPTIONS.find(t => t.value === formData.type)?.color || 'bg-gray-100 text-gray-700'}`}>
                        {TYPE_OPTIONS.find(t => t.value === formData.type)?.label || formData.type}
                      </span>
                    )}
                    {formData.isBreaking && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded">
                        Breaking Change
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {formData.title || 'Untitled'}
                  </h3>
                  {formData.description && (
                    <div className="text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-wrap">
                      {formData.description}
                    </div>
                  )}
                  {formData.items.filter(i => i.content).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Changes</h4>
                      <ul className="space-y-2">
                        {formData.items.filter(i => i.content).map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-slate-700/50 rounded">
                            <span className="text-purple-500">-</span>
                            <div>
                              <p className="text-gray-700 dark:text-gray-300">{item.content}</p>
                              {item.apiEndpoint && (
                                <code className="text-xs bg-gray-200 dark:bg-slate-600 px-1 rounded">
                                  {item.apiEndpoint}
                                </code>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit Mode */
                <form onSubmit={handleSave} className="space-y-4">
                  {/* Version & Title */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Version *
                      </label>
                      <input
                        type="text"
                        value={formData.version}
                        onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                        placeholder="2.1.0"
                        className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="New Feature Release"
                        className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  {/* Type & Category */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type
                      </label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                      >
                        <option value="">Select type...</option>
                        {TYPE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                      >
                        <option value="">Select category...</option>
                        {CATEGORY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Breaking Change Toggle */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isBreaking"
                      checked={formData.isBreaking}
                      onChange={(e) => setFormData(prev => ({ ...prev, isBreaking: e.target.checked }))}
                      className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="isBreaking" className="text-sm text-gray-700 dark:text-gray-300">
                      This is a breaking change
                    </label>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description (supports Markdown)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the changes in detail..."
                      rows={4}
                      className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white font-mono text-sm"
                    />
                  </div>

                  {/* Items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Change Items
                      </label>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        + Add Item
                      </button>
                    </div>
                    <div className="space-y-3">
                      {formData.items.map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={item.content}
                              onChange={(e) => handleItemChange(index, 'content', e.target.value)}
                              placeholder="Change description..."
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white text-sm"
                            />
                          </div>
                          <div className="w-40">
                            <input
                              type="text"
                              value={item.apiEndpoint}
                              onChange={(e) => handleItemChange(index, 'apiEndpoint', e.target.value)}
                              placeholder="API endpoint"
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white text-sm font-mono"
                            />
                          </div>
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="px-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            >
                              X
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 flex justify-end gap-3">
              <button
                onClick={() => { setShowEditor(false); resetForm(); }}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isFormValid}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : (editingEntry ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

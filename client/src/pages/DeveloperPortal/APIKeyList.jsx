import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function APIKeyList({ apiKeys = [], onKeyCreated, onKeyDeleted, onRefresh }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState(['read']);
  const [createdKey, setCreatedKey] = useState(null);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const token = localStorage.getItem('token');

  const formatDate = (dateString) => {
    if (!dateString) return t('developer.never', 'Never');
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/api-tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newKeyName,
          scopes: newKeyScopes
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create API key');
      }

      const data = await res.json();
      setCreatedKey(data.token || data.key);
      setNewKeyName('');
      setNewKeyScopes(['read']);
      if (onKeyCreated) onKeyCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (keyId) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/api-tokens/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to delete API key');
      }

      setDeleteConfirm(null);
      if (onKeyDeleted) onKeyDeleted();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleKey = async (keyId, currentStatus) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/api-tokens/${keyId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_active: !currentStatus
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update API key');
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const availableScopes = [
    { id: 'read', label: t('developer.scopeRead', 'Read'), description: t('developer.scopeReadDesc', 'Read access to resources') },
    { id: 'write', label: t('developer.scopeWrite', 'Write'), description: t('developer.scopeWriteDesc', 'Create and update resources') },
    { id: 'delete', label: t('developer.scopeDelete', 'Delete'), description: t('developer.scopeDeleteDesc', 'Delete resources') },
    { id: 'admin', label: t('developer.scopeAdmin', 'Admin'), description: t('developer.scopeAdminDesc', 'Full administrative access') }
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('developer.manageApiKeys', 'Manage API Keys')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            {t('developer.apiKeysDescription', 'Create and manage API keys for programmatic access')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          aria-label={t('developer.createNewKey', 'Create new API key')}
        >
          <span aria-hidden="true">➕</span>
          {t('developer.createKey', 'Create Key')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6" role="alert">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* API Keys Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {apiKeys.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="text-5xl mb-4" aria-hidden="true"><Key size={48} className="mx-auto text-gray-400" /></div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('developer.noApiKeys', 'No API Keys')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('developer.noApiKeysDescription', 'Create your first API key to get started')}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('developer.createFirstKey', 'Create First Key')}
            </button>
          </div>
        ) : (
          <table className="w-full" role="table" aria-label="API keys list">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('developer.keyName', 'Name')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('developer.keyPreview', 'Key Preview')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('developer.lastUsed', 'Last Used')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('developer.status', 'Status')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {apiKeys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900 dark:text-white">{key.name}</div>
                    {key.scopes && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {Array.isArray(key.scopes) ? key.scopes.join(', ') : key.scopes}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">
                      {key.token_preview || `***${key.key?.slice(-8) || '****'}`}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(key.last_used_at || key.lastUsed)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      key.is_active !== false
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {key.is_active !== false ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleToggleKey(key.id, key.is_active !== false)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          key.is_active !== false
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400'
                        }`}
                        aria-label={key.is_active !== false ? t('developer.disableKey', 'Disable key') : t('developer.enableKey', 'Enable key')}
                      >
                        {key.is_active !== false ? t('common.disable', 'Disable') : t('common.enable', 'Enable')}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(key.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 transition-colors"
                        aria-label={t('developer.deleteKey', 'Delete key')}
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-key-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 id="create-key-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('developer.createApiKey', 'Create API Key')}
              </h3>
            </div>

            {createdKey ? (
              <div className="p-6">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                  <p className="text-green-800 dark:text-green-200 text-sm mb-2">
                    {t('developer.keyCreatedSuccess', 'API key created successfully! Copy it now - you won\'t be able to see it again.')}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 rounded border border-green-300 dark:border-green-700 font-mono text-sm break-all">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      aria-label={t('common.copy', 'Copy to clipboard')}
                    >
                      <span aria-hidden="true">📋</span>
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreatedKey(null);
                  }}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="p-6">
                <div className="mb-4">
                  <label htmlFor="key-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('developer.keyName', 'Key Name')}
                  </label>
                  <input
                    id="key-name"
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder={t('developer.keyNamePlaceholder', 'e.g., Production API Key')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('developer.scopes', 'Scopes')}
                  </label>
                  <div className="space-y-2">
                    {availableScopes.map((scope) => (
                      <label key={scope.id} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newKeyScopes.includes(scope.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyScopes([...newKeyScopes, scope.id]);
                            } else {
                              setNewKeyScopes(newKeyScopes.filter(s => s !== scope.id));
                            }
                          }}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">{scope.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{scope.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewKeyName('');
                      setNewKeyScopes(['read']);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !newKeyName.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 id="delete-confirm-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('developer.deleteKeyConfirm', 'Delete API Key?')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('developer.deleteKeyWarning', 'This action cannot be undone. Any applications using this key will stop working.')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => handleDeleteKey(deleteConfirm)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

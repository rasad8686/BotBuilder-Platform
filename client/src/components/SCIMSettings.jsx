import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Key,
  Copy,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Users,
  Clock,
  Activity,
  Loader2,
  Plus,
  ExternalLink
} from 'lucide-react';
import api from '../api/axios';

const SCIMSettings = ({ configId, scimEnabled, onEnableChange }) => {
  const { t } = useTranslation();

  // State
  const [tokens, setTokens] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [provisionedUsers, setProvisionedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  // New token form
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Test result
  const [testResult, setTestResult] = useState(null);

  // Pagination for logs
  const [logsPage, setLogsPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const baseUrl = window.location.origin.replace(':3001', ':3000');
  const scimEndpoint = `${baseUrl}/scim/v2`;

  useEffect(() => {
    if (configId && scimEnabled) {
      fetchData();
    }
  }, [configId, scimEnabled]);

  const fetchData = async () => {
    if (!configId) return;

    try {
      setLoading(true);
      const [tokensRes, logsRes, usersRes] = await Promise.all([
        api.get(`/sso/config/${configId}/scim/tokens`),
        api.get(`/sso/config/${configId}/scim/logs?page=${logsPage}&limit=10`),
        api.get(`/sso/config/${configId}/scim/users`)
      ]);

      setTokens(tokensRes.data.tokens || []);
      setSyncLogs(logsRes.data.logs || []);
      setTotalLogs(logsRes.data.total || 0);
      setProvisionedUsers(usersRes.data.users || []);
    } catch (error) {
      console.error('Error fetching SCIM data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateToken = async () => {
    if (!newTokenName.trim()) return;

    try {
      setTokenLoading(true);
      const response = await api.post(`/sso/config/${configId}/scim/tokens`, {
        name: newTokenName.trim()
      });

      setGeneratedToken(response.data.token);
      setNewTokenName('');
      fetchData();
    } catch (error) {
      console.error('Error generating token:', error);
      alert(t('sso.scim.tokenError', 'Failed to generate token'));
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRevokeToken = async (tokenId) => {
    if (!window.confirm(t('sso.scim.confirmRevoke', 'Are you sure you want to revoke this token?'))) return;

    try {
      await api.delete(`/sso/config/${configId}/scim/tokens/${tokenId}`);
      fetchData();
    } catch (error) {
      console.error('Error revoking token:', error);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestLoading(true);
      setTestResult(null);

      const response = await api.post(`/sso/config/${configId}/scim/test`);
      setTestResult(response.data);
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.error || 'Connection test failed'
      });
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(t('common.copied', 'Copied to clipboard'));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const maskToken = (token) => {
    if (!token) return '';
    return token.substring(0, 13) + '...' + token.substring(token.length - 4);
  };

  if (!scimEnabled) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
              {t('sso.scim.disabled', 'SCIM is disabled')}
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              {t('sso.scim.enableFirst', 'Enable SCIM in the configuration tab to use user provisioning.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SCIM Endpoint */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-blue-600" />
          {t('sso.scim.endpoint', 'SCIM Endpoint')}
        </h3>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('sso.scim.baseUrl', 'Base URL')}</p>
            <code className="text-sm font-mono text-gray-900 dark:text-white">{scimEndpoint}</code>
          </div>
          <button
            onClick={() => copyToClipboard(scimEndpoint)}
            className="p-2 text-gray-500 hover:text-blue-600"
          >
            <Copy className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
            <p className="text-xs text-gray-500 mb-1">Users Endpoint</p>
            <code className="text-xs font-mono">{scimEndpoint}/Users</code>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
            <p className="text-xs text-gray-500 mb-1">Groups Endpoint</p>
            <code className="text-xs font-mono">{scimEndpoint}/Groups</code>
          </div>
        </div>

        {/* Test Connection */}
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleTestConnection}
            disabled={testLoading || tokens.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {testLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {t('sso.scim.testConnection', 'Test Connection')}
          </button>

          {testResult && (
            <div className={`flex items-center gap-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.success ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              <span className="text-sm">{testResult.message || (testResult.success ? 'Connected' : 'Failed')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Generate Token */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-600" />
          {t('sso.scim.generateToken', 'Generate Token')}
        </h3>

        <div className="flex gap-4">
          <input
            type="text"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder={t('sso.scim.tokenName', 'Token name (e.g., Azure AD SCIM)')}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={handleGenerateToken}
            disabled={!newTokenName.trim() || tokenLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {tokenLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {t('sso.scim.generate', 'Generate')}
          </button>
        </div>

        {/* Generated Token Display */}
        {generatedToken && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-900 dark:text-green-100">
                  {t('sso.scim.tokenGenerated', 'Token generated successfully!')}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {t('sso.scim.tokenWarning', 'Copy this token now. It will not be shown again.')}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={generatedToken}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(generatedToken)}
                    className="p-2 text-blue-600 hover:text-blue-700"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Token List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-600" />
          {t('sso.scim.tokens', 'Access Tokens')}
          <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
            {tokens.length}
          </span>
        </h3>

        {tokens.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('sso.scim.noTokens', 'No tokens generated yet')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <div
                key={token.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  token.is_active
                    ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 opacity-60'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{token.name}</span>
                    {!token.is_active && (
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs rounded">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="font-mono">{token.token_prefix}...</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Created: {formatDate(token.created_at)}
                    </span>
                    {token.last_used_at && (
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Last used: {formatDate(token.last_used_at)}
                      </span>
                    )}
                  </div>
                </div>
                {token.is_active && (
                  <button
                    onClick={() => handleRevokeToken(token.id)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Provisioned Users */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          {t('sso.scim.provisionedUsers', 'Provisioned Users')}
          <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
            {provisionedUsers.length}
          </span>
        </h3>

        {provisionedUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('sso.scim.noUsers', 'No users provisioned via SCIM yet')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Email</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">External ID</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Provisioned</th>
                </tr>
              </thead>
              <tbody>
                {provisionedUsers.slice(0, 10).map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3">{user.email}</td>
                    <td className="py-2 px-3">{user.name}</td>
                    <td className="py-2 px-3 font-mono text-xs">{user.external_id}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync Activity Log */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          {t('sso.scim.activityLog', 'Sync Activity')}
        </h3>

        {syncLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('sso.scim.noActivity', 'No sync activity yet')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  log.status === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : log.status === 'failed'
                    ? 'bg-red-50 dark:bg-red-900/20'
                    : 'bg-yellow-50 dark:bg-yellow-900/20'
                }`}
              >
                {log.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : log.status === 'failed' ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                )}
                <div className="flex-1">
                  <span className="font-medium">{log.operation}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span>{log.resource_type}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="font-mono text-xs">{log.external_id}</span>
                  {log.error_message && (
                    <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500">{formatDate(log.created_at)}</span>
              </div>
            ))}

            {totalLogs > 10 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                  disabled={logsPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1">
                  Page {logsPage} of {Math.ceil(totalLogs / 10)}
                </span>
                <button
                  onClick={() => setLogsPage(p => p + 1)}
                  disabled={logsPage >= Math.ceil(totalLogs / 10)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SCIMSettings;

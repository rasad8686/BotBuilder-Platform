import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

const SMSSettings = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Settings state
  const [settings, setSettings] = useState({
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    enabled: false
  });

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', content: '' });
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsPagination, setLogsPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [logsFilter, setLogsFilter] = useState({ status: '', search: '', direction: '' });

  // Test SMS state
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (activeTab === 'settings') {
      loadSettings();
    } else if (activeTab === 'templates') {
      loadTemplates();
    } else if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab]);

  // ============ Settings Functions ============

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/sms/settings');
      setSettings(response.data);
    } catch (err) {
      setError('Failed to load SMS settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/api/sms/settings', settings);
      setSettings(response.data);
      setSuccess('Settings saved successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const sendTestSMS = async () => {
    if (!testPhone) {
      setError('Please enter a phone number');
      return;
    }

    setSendingTest(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/api/sms/test', { to: testPhone });
      setSuccess('Test SMS sent successfully!');
      setTestPhone('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send test SMS');
    } finally {
      setSendingTest(false);
    }
  };

  // ============ Templates Functions ============

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/sms/templates');
      setTemplates(response.data);
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const openTemplateModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({ name: template.name, content: template.content });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ name: '', content: '' });
    }
    setShowTemplateModal(true);
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setEditingTemplate(null);
    setTemplateForm({ name: '', content: '' });
  };

  const saveTemplate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingTemplate) {
        await api.put(`/api/sms/templates/${editingTemplate.id}`, templateForm);
      } else {
        await api.post('/api/sms/templates', templateForm);
      }
      closeTemplateModal();
      loadTemplates();
      setSuccess('Template saved successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await api.delete(`/api/sms/templates/${id}`);
      loadTemplates();
      setSuccess('Template deleted successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete template');
    }
  };

  // ============ Logs Functions ============

  const loadLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(logsFilter.status && { status: logsFilter.status }),
        ...(logsFilter.search && { search: logsFilter.search }),
        ...(logsFilter.direction && { direction: logsFilter.direction })
      });
      const response = await api.get(`/api/sms/logs?${params}`);
      setLogs(response.data.data);
      setLogsPagination(response.data.pagination);
    } catch (err) {
      setError('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setLogsFilter(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs(1);
    }
  }, [logsFilter]);

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">SMS Settings</h1>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button onClick={() => setError('')} className="float-right font-bold">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
          <button onClick={() => setSuccess('')} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {['settings', 'templates', 'logs'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'settings' && 'Settings'}
              {tab === 'templates' && 'Templates'}
              {tab === 'logs' && 'Logs'}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Twilio Configuration</h2>

          <form onSubmit={saveSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account SID
              </label>
              <input
                type="text"
                value={settings.twilio_account_sid}
                onChange={(e) => setSettings(prev => ({ ...prev, twilio_account_sid: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auth Token
              </label>
              <input
                type="password"
                value={settings.twilio_auth_token}
                onChange={(e) => setSettings(prev => ({ ...prev, twilio_auth_token: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={settings.twilio_auth_token_masked || 'Enter Auth Token'}
              />
              {settings.twilio_auth_token_masked && (
                <p className="text-xs text-gray-500 mt-1">Current: {settings.twilio_auth_token_masked}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={settings.twilio_phone_number}
                onChange={(e) => setSettings(prev => ({ ...prev, twilio_phone_number: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+15551234567"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={settings.enabled}
                onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
                Enable SMS
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>

          {/* Test SMS Section */}
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Send Test SMS</h3>
            <div className="flex space-x-4">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+15551234567"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendTestSMS}
                disabled={sendingTest}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {sendingTest ? 'Sending...' : 'Send Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">SMS Templates</h2>
            <button
              onClick={() => openTemplateModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              + Add Template
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No templates yet</div>
          ) : (
            <div className="divide-y">
              {templates.map((template) => (
                <div key={template.id} className="p-4 flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{template.name}</h3>
                    <p className="text-gray-600 text-sm mt-1">{template.content}</p>
                    {(() => {
                      if (!template.variables) return null;
                      try {
                        const vars = JSON.parse(template.variables);
                        if (!Array.isArray(vars) || vars.length === 0) return null;
                        return (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">Variables: </span>
                            {vars.map((v, i) => (
                              <span key={i} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mr-1">
                                {`{${v}}`}
                              </span>
                            ))}
                          </div>
                        );
                      } catch { return null; }
                    })()}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openTemplateModal(template)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Template Modal */}
          {showTemplateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h3>
                <form onSubmit={saveTemplate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content
                    </label>
                    <textarea
                      value={templateForm.content}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, content: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use {'{name}'}, {'{code}'} etc. for variables
                    </p>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={closeTemplateModal}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <div className="flex space-x-4">
              <select
                value={logsFilter.direction}
                onChange={(e) => handleFilterChange('direction', e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Directions</option>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
              <select
                value={logsFilter.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
              </select>
              <input
                type="text"
                value={logsFilter.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search phone or content..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No SMS logs found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From / To</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log) => (
                      <tr key={log.id} className={`hover:bg-gray-50 ${log.direction === 'inbound' ? 'bg-gray-50' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            log.direction === 'inbound'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {log.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {log.direction === 'inbound' ? (
                            <div>
                              <span className="text-gray-500">From:</span> {log.from_number}
                            </div>
                          ) : (
                            <div>
                              <span className="text-gray-500">To:</span> {log.to_number}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className={`max-w-xs truncate ${log.direction === 'inbound' ? 'text-purple-700' : ''}`}>
                            {log.content}
                          </div>
                          {log.error_message && (
                            <div className="text-xs text-red-500 mt-1">{log.error_message}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusBadge(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(log.sent_at || log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {logsPagination.pages > 1 && (
                <div className="p-4 border-t flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    Page {logsPagination.page} of {logsPagination.pages} ({logsPagination.total} total)
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => loadLogs(logsPagination.page - 1)}
                      disabled={logsPagination.page === 1}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => loadLogs(logsPagination.page + 1)}
                      disabled={logsPagination.page === logsPagination.pages}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SMSSettings;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiPlus, FiTrash2, FiEdit2, FiCopy, FiRefreshCw, FiSend, FiCheck, FiX, FiEye } from 'react-icons/fi';
import { API_URL } from '../config/api';

const API_BASE_URL = API_URL;

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: []
  });

  useEffect(() => {
    console.log('🟢 [INIT] Component mounted, fetching data...');
    fetchWebhooks();
    fetchAvailableEvents();
  }, []);

  // Debug logging for availableEvents state changes
  useEffect(() => {
    console.log('🟡 [STATE] availableEvents changed:', availableEvents);
  }, [availableEvents]);

  const fetchWebhooks = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/webhooks`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setWebhooks(response.data.data || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableEvents = async () => {
    console.log('🔵 [EVENTS] Starting fetchAvailableEvents...');
    try {
      const token = localStorage.getItem('token');
      console.log('🔵 [EVENTS] Token exists:', !!token);
      console.log('🔵 [EVENTS] Token value:', token?.substring(0, 20) + '...');
      console.log('🔵 [EVENTS] Fetching from URL:', `${API_BASE_URL}/api/webhooks/events/list`);

      const response = await axios.get(`${API_BASE_URL}/api/webhooks/events/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('🔵 [EVENTS] Response status:', response.status);
      console.log('🔵 [EVENTS] Response data:', response.data);
      console.log('🔵 [EVENTS] Events array:', response.data.data);
      console.log('🔵 [EVENTS] Events count:', response.data.data?.length);

      setAvailableEvents(response.data.data || []);
      console.log('🔵 [EVENTS] State updated with', response.data.data?.length || 0, 'events');
    } catch (error) {
      console.error('🔴 [EVENTS] Error fetching events:', error);
      console.error('🔴 [EVENTS] Error response:', error.response?.data);
      console.error('🔴 [EVENTS] Error status:', error.response?.status);
    }
  };

  const fetchWebhookLogs = async (webhookId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/webhooks/${webhookId}/logs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setWebhookLogs(response.data.data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const handleCreateWebhook = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.url || formData.events.length === 0) {
      alert('Please fill all fields and select at least one event');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/webhooks`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`Webhook created! Secret: ${response.data.data.secret}\n\nSave this secret - it will not be shown again!`);
      setShowCreateModal(false);
      setFormData({ name: '', url: '', events: [] });
      fetchWebhooks();
    } catch (error) {
      console.error('Error creating webhook:', error);
      alert(error.response?.data?.message || 'Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/webhooks/${webhookId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      alert(error.response?.data?.message || 'Failed to delete webhook');
    }
  };

  const handleTestWebhook = async (webhookId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/webhooks/${webhookId}/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(response.data.message);
    } catch (error) {
      console.error('Error testing webhook:', error);
      alert(error.response?.data?.message || 'Failed to test webhook');
    }
  };

  const handleToggleEvent = (eventName) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventName)
        ? prev.events.filter(e => e !== eventName)
        : [...prev.events, eventName]
    }));
  };

  const viewLogs = (webhook) => {
    setSelectedWebhook(webhook);
    fetchWebhookLogs(webhook.id);
    setShowLogsModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading webhooks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Webhooks</h1>
            <p className="text-gray-600">Manage webhook integrations for your bots</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            Create Webhook
          </button>
        </div>

        {/* Webhooks List */}
        {webhooks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400 mb-4">
              <FiSend className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No webhooks yet</h3>
            <p className="text-gray-500 mb-6">Create your first webhook to start receiving events</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg inline-flex items-center gap-2 transition-colors"
            >
              <FiPlus className="w-5 h-5" />
              Create Webhook
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {webhooks.map(webhook => (
              <div key={webhook.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-800">{webhook.name}</h3>
                      {webhook.is_active ? (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-3 font-mono bg-gray-50 p-2 rounded">
                      {webhook.url}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {webhook.events.map(event => (
                        <span key={event} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs">
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => viewLogs(webhook)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Logs"
                    >
                      <FiEye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleTestWebhook(webhook.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Test Webhook"
                    >
                      <FiSend className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                {webhook.stats && (
                  <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-800">{webhook.stats.total_attempts}</p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{webhook.stats.successful}</p>
                      <p className="text-xs text-gray-500">Success</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{webhook.stats.failed}</p>
                      <p className="text-xs text-gray-500">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{webhook.stats.success_rate}%</p>
                      <p className="text-xs text-gray-500">Success Rate</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Webhook Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">Create Webhook</h2>
              </div>

              <form onSubmit={handleCreateWebhook} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="My Webhook"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/webhook"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Must be HTTPS in production. Use webhook.site for testing.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select Events to Subscribe ({availableEvents.length} events available)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
                      {availableEvents.map(event => (
                        <label
                          key={event.name}
                          className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.events.includes(event.name)}
                            onChange={() => handleToggleEvent(event.name)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-800">{event.name}</p>
                            <p className="text-xs text-gray-500">{event.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    Create Webhook
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({ name: '', url: '', events: [] });
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Logs Modal */}
        {showLogsModal && selectedWebhook && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedWebhook.name} - Logs</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedWebhook.url}</p>
                </div>
                <button
                  onClick={() => {
                    setShowLogsModal(false);
                    setSelectedWebhook(null);
                    setWebhookLogs([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {webhookLogs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No logs yet</p>
                ) : (
                  <div className="space-y-3">
                    {webhookLogs.map(log => (
                      <div
                        key={log.id}
                        className={`border rounded-lg p-4 ${
                          log.response_status >= 200 && log.response_status < 300
                            ? 'border-green-200 bg-green-50'
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            {log.response_status >= 200 && log.response_status < 300 ? (
                              <FiCheck className="w-5 h-5 text-green-600" />
                            ) : (
                              <FiX className="w-5 h-5 text-red-600" />
                            )}
                            <span className="font-semibold text-gray-800">{log.event_type}</span>
                            {log.response_status && (
                              <span className="text-sm text-gray-600">Status: {log.response_status}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {log.error && (
                          <p className="text-sm text-red-700 mt-2">Error: {log.error}</p>
                        )}
                        {log.response_time_ms && (
                          <p className="text-xs text-gray-600 mt-1">Response time: {log.response_time_ms}ms</p>
                        )}
                        {log.retry_count > 0 && (
                          <p className="text-xs text-orange-600 mt-1">Retry count: {log.retry_count}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

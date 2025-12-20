import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';

export default function SlackChannel() {
  const [searchParams] = useSearchParams();
  const [workspaces, setWorkspaces] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Channel selector state
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [slackChannels, setSlackChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Test message state
  const [testMessageModal, setTestMessageModal] = useState(false);
  const [testChannelId, setTestChannelId] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    // Check for OAuth callback params
    const successParam = searchParams.get('success');
    const errorParam = searchParams.get('error');
    const teamName = searchParams.get('team');

    if (successParam) {
      setSuccess(
        successParam === 'connected'
          ? `Successfully connected to ${teamName || 'Slack workspace'}!`
          : `Successfully reconnected to ${teamName || 'Slack workspace'}!`
      );
    }
    if (errorParam) {
      setError(`OAuth error: ${errorParam}`);
    }

    fetchWorkspaces();
    fetchStats();
  }, [searchParams]);

  const fetchWorkspaces = async () => {
    try {
      const response = await api.get('/api/channels/slack');
      setWorkspaces(response.data.data || []);
    } catch (err) {
      setError('Failed to load Slack workspaces');
      // Error loading Slack workspaces - silent fail
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/channels/slack/stats');
      setStats(response.data.data);
    } catch (err) {
      // Failed to load stats - silent fail
    }
  };

  const handleAddToSlack = async () => {
    try {
      const response = await api.get('/api/channels/slack/oauth');
      // Redirect to Slack OAuth
      window.location.href = response.data.data.authUrl;
    } catch (err) {
      setError('Failed to start OAuth flow');
    }
  };

  const handleDisconnect = async (workspaceId) => {
    if (!confirm('Are you sure you want to disconnect this Slack workspace?')) return;

    try {
      await api.delete(`/api/channels/slack/${workspaceId}`);
      setWorkspaces(workspaces.filter(w => w.id !== workspaceId));
      fetchStats();
      setSuccess('Workspace disconnected successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect');
    }
  };

  const handleToggleActive = async (workspace) => {
    try {
      await api.put(`/api/channels/slack/${workspace.id}`, {
        isActive: !workspace.isActive
      });
      setWorkspaces(workspaces.map(w =>
        w.id === workspace.id ? { ...w, isActive: !w.isActive } : w
      ));
    } catch (err) {
      setError('Failed to update workspace');
    }
  };

  const handleTestConnection = async (workspaceId) => {
    try {
      await api.post('/api/channels/slack/test', { channelId: workspaceId });
      setSuccess('Connection test successful!');
    } catch (err) {
      setError(err.response?.data?.error || 'Connection test failed');
    }
  };

  const loadSlackChannels = async (workspace) => {
    setSelectedWorkspace(workspace);
    setLoadingChannels(true);
    try {
      const response = await api.get(`/api/channels/slack/${workspace.id}/channels`);
      setSlackChannels(response.data.data || []);
    } catch (err) {
      setError('Failed to load Slack channels');
    } finally {
      setLoadingChannels(false);
    }
  };

  const openTestMessageModal = (workspace) => {
    setSelectedWorkspace(workspace);
    loadSlackChannels(workspace);
    setTestMessageModal(true);
  };

  const handleSendTestMessage = async () => {
    if (!testChannelId || !testMessage.trim()) return;

    setSendingTest(true);
    try {
      await api.post(`/api/channels/slack/${selectedWorkspace.id}/send-test`, {
        slackChannelId: testChannelId,
        message: testMessage
      });
      setSuccess('Test message sent successfully!');
      setTestMessageModal(false);
      setTestChannelId('');
      setTestMessage('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Slack Integration</h1>
        <p className="text-gray-600 mt-1">Connect your bots to Slack workspaces</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right">&times;</button>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right">&times;</button>
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Workspaces</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totals?.totalWorkspaces || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold text-green-600">{stats.totals?.activeWorkspaces || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Messages</div>
            <div className="text-2xl font-bold text-indigo-600">{stats.totals?.totalMessages || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Commands</div>
            <div className="text-2xl font-bold text-purple-600">{stats.totals?.totalCommands || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Unique Users</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totals?.totalUniqueUsers || 0}</div>
          </div>
        </div>
      )}

      {/* Add to Slack Button */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Connect New Workspace</h2>
          <p className="text-sm text-gray-500 mt-1">
            Add BotBuilder to your Slack workspace
          </p>
        </div>
        <div className="p-6">
          <button
            onClick={handleAddToSlack}
            className="inline-flex items-center gap-3 px-6 py-3 bg-[#4A154B] text-white rounded-lg hover:bg-[#3d1140] transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
            <span className="font-medium">Add to Slack</span>
          </button>
          <p className="text-xs text-gray-500 mt-3">
            You'll be redirected to Slack to authorize the connection
          </p>
        </div>
      </div>

      {/* Connected Workspaces */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Connected Workspaces</h2>
        </div>

        {workspaces.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
              <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
            </svg>
            <p>No Slack workspaces connected yet</p>
            <p className="text-sm mt-1">Click "Add to Slack" to connect your first workspace</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#4A154B] rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/>
                        <path d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{workspace.teamName}</div>
                      <div className="text-sm text-gray-500">
                        Team ID: {workspace.teamId}
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${workspace.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {workspace.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openTestMessageModal(workspace)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Send Test Message"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleTestConnection(workspace.id)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Test Connection"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleToggleActive(workspace)}
                      className={`p-2 rounded ${workspace.isActive ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                      title={workspace.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {workspace.isActive ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDisconnect(workspace.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                      title="Disconnect"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Scopes */}
                <div className="mt-4">
                  <div className="text-xs text-gray-500 mb-2">Permissions</div>
                  <div className="flex flex-wrap gap-1">
                    {(workspace.scopes || []).slice(0, 5).map((scope, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {scope}
                      </span>
                    ))}
                    {(workspace.scopes || []).length > 5 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        +{workspace.scopes.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Message Modal */}
      {testMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Send Test Message</h3>
              <p className="text-sm text-gray-500">{selectedWorkspace?.teamName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Channel
                </label>
                {loadingChannels ? (
                  <div className="text-sm text-gray-500">Loading channels...</div>
                ) : (
                  <select
                    value={testChannelId}
                    onChange={(e) => setTestChannelId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a channel...</option>
                    {slackChannels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name} {ch.isPrivate ? '(private)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter your test message..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports Slack markdown: *bold*, _italic_, `code`
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setTestMessageModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTestMessage}
                disabled={!testChannelId || !testMessage.trim() || sendingTest}
                className="px-4 py-2 bg-[#4A154B] text-white rounded-lg hover:bg-[#3d1140] disabled:opacity-50"
              >
                {sendingTest ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="mt-8 bg-purple-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-purple-900 mb-4">Setup Instructions</h3>
        <ol className="list-decimal list-inside space-y-2 text-purple-800">
          <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="font-medium underline">api.slack.com/apps</a> and create a new app</li>
          <li>Under "OAuth & Permissions", add the required Bot Token Scopes</li>
          <li>Set the redirect URL to: <code className="bg-purple-100 px-1 rounded">{window.location.origin}/api/channels/slack/callback</code></li>
          <li>Enable Event Subscriptions and set the URL to: <code className="bg-purple-100 px-1 rounded">{window.location.origin}/api/webhooks/slack/events</code></li>
          <li>Add Slash Commands URL: <code className="bg-purple-100 px-1 rounded">{window.location.origin}/api/webhooks/slack/commands</code></li>
          <li>Add Interactivity URL: <code className="bg-purple-100 px-1 rounded">{window.location.origin}/api/webhooks/slack/interactive</code></li>
          <li>Copy Client ID, Client Secret, and Signing Secret to your .env file</li>
          <li>Click "Add to Slack" above to connect your workspace</li>
        </ol>
        <div className="mt-4 p-3 bg-purple-100 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>Required Environment Variables:</strong><br/>
            <code>SLACK_CLIENT_ID</code>, <code>SLACK_CLIENT_SECRET</code>, <code>SLACK_SIGNING_SECRET</code>
          </p>
        </div>
      </div>
    </div>
  );
}

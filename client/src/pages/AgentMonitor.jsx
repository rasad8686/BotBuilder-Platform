import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const statusColors = {
  pending: { bg: '#fff3cd', color: '#856404' },
  running: { bg: '#cce5ff', color: '#004085' },
  completed: { bg: '#d4edda', color: '#155724' },
  failed: { bg: '#f8d7da', color: '#721c24' },
  paused: { bg: '#e2e3e5', color: '#383d41' }
};

const AgentMonitor = () => {
  const { t } = useTranslation();
  const { id: agentId } = useParams();

  const [agent, setAgent] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState([]);
  const [logs, setLogs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const token = localStorage.getItem('token');
  const pollRef = useRef(null);

  useEffect(() => {
    fetchData();

    // Poll for real-time data
    pollRef.current = setInterval(fetchRealtimeData, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [agentRes, analyticsRes, logsRes, suggestionsRes] = await Promise.all([
        fetch(`/api/autonomous/agents/${agentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/autonomous/agents/${agentId}/analytics?days=30`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/autonomous/agents/${agentId}/logs?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/autonomous/agents/${agentId}/suggestions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!agentRes.ok) throw new Error('Agent not found');

      const agentData = await agentRes.json();
      setAgent(agentData.agent);

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData.analytics);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }

      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        setSuggestions(suggestionsData.suggestions || []);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRealtimeData = async () => {
    try {
      const res = await fetch(`/api/autonomous/agents/${agentId}/analytics/realtime`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setRealtimeMetrics(data.metrics || []);
      }
    } catch (err) {
      // Silent fail for polling
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading', 'Loading...')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px' }}>
          <h2 style={{ color: '#c53030' }}>{t('common.error', 'Error')}</h2>
          <p style={{ color: '#6c757d' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e9ecef', padding: '16px 32px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Link to="/autonomous" style={{ color: '#667eea', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
            ← {t('autonomous.backToAgents', 'Back to Agents')}
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px'
              }}>
                🤖
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', color: '#1a1a2e' }}>{agent?.name}</h1>
                <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
                  {t('agentMonitor.title', 'Real-time Monitoring')}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Link
                to={`/autonomous/agents/${agentId}/tasks`}
                style={{
                  padding: '10px 20px',
                  background: '#e9ecef',
                  color: '#495057',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                {t('agentMonitor.viewTasks', 'View Tasks')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e9ecef', padding: '0 32px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '4px' }}>
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'metrics', label: 'Metrics', icon: '📈' },
            { id: 'logs', label: 'Logs', icon: '📋' },
            { id: 'alerts', label: 'Alerts', icon: '⚠️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '16px 24px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #667eea' : '2px solid transparent',
                color: activeTab === tab.id ? '#667eea' : '#6c757d',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 32px' }}>

        {/* Overview Tab */}
        {activeTab === 'overview' && analytics && (
          <div>
            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '8px' }}>Total Tasks</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a1a2e' }}>
                  {analytics.performance?.totalTasks || 0}
                </div>
              </div>
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '8px' }}>Success Rate</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#48bb78' }}>
                  {analytics.performance?.successRate || 0}%
                </div>
              </div>
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '8px' }}>Avg Duration</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#4299e1' }}>
                  {formatDuration(analytics.performance?.avgDuration)}
                </div>
              </div>
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '8px' }}>Total Tokens</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#9f7aea' }}>
                  {(analytics.performance?.totalTokens || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Trends Chart (Simplified) */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1a1a2e' }}>Execution Trends</h3>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '200px' }}>
                {(analytics.trends || []).slice(-14).map((trend, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '100%',
                      background: `linear-gradient(to top, #48bb78 ${trend.successRate}%, #f56565 ${trend.successRate}%)`,
                      height: `${Math.max((trend.executions / Math.max(...analytics.trends.map(t => t.executions))) * 150, 4)}px`,
                      borderRadius: '4px 4px 0 0'
                    }}></div>
                    <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '4px' }}>
                      {new Date(trend.period).getDate()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tool Usage */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1a1a2e' }}>Tool Usage</h3>
                {(analytics.tools || []).length === 0 ? (
                  <p style={{ color: '#6c757d', textAlign: 'center', padding: '20px' }}>No tool usage data</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(analytics.tools || []).map((tool, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '500', color: '#1a1a2e' }}>{tool.toolName}</span>
                            <span style={{ color: '#6c757d', fontSize: '13px' }}>{tool.usageCount}x</span>
                          </div>
                          <div style={{ height: '6px', background: '#e9ecef', borderRadius: '3px' }}>
                            <div style={{
                              height: '100%',
                              width: `${tool.successRate}%`,
                              background: '#48bb78',
                              borderRadius: '3px'
                            }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggestions */}
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1a1a2e' }}>Optimization Suggestions</h3>
                {suggestions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <span style={{ fontSize: '32px' }}>✅</span>
                    <p style={{ color: '#6c757d', marginTop: '8px' }}>No suggestions - agent is performing well!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {suggestions.map((suggestion, i) => (
                      <div key={i} style={{
                        padding: '12px',
                        background: suggestion.priority === 'high' ? '#fff5f5' : '#f8f9fa',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${suggestion.priority === 'high' ? '#f56565' : '#667eea'}`
                      }}>
                        <div style={{ fontWeight: '500', color: '#1a1a2e', marginBottom: '4px' }}>
                          {suggestion.message}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>
                          Impact: {suggestion.impact}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1a1a2e' }}>Real-time Metrics</h3>

            {realtimeMetrics.length === 0 ? (
              <p style={{ color: '#6c757d', textAlign: 'center', padding: '40px' }}>No recent metrics</p>
            ) : (
              <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e9ecef' }}>
                      <th style={{ textAlign: 'left', padding: '12px', color: '#6c757d', fontWeight: '600' }}>Time</th>
                      <th style={{ textAlign: 'left', padding: '12px', color: '#6c757d', fontWeight: '600' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '12px', color: '#6c757d', fontWeight: '600' }}>Value</th>
                      <th style={{ textAlign: 'left', padding: '12px', color: '#6c757d', fontWeight: '600' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realtimeMetrics.map((metric, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px', color: '#6c757d', fontSize: '13px' }}>
                          {formatDate(metric.timestamp)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            background: '#667eea20',
                            color: '#667eea',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            {metric.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: '600', color: '#1a1a2e' }}>
                          {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                        </td>
                        <td style={{ padding: '12px', color: '#6c757d', fontSize: '13px' }}>
                          {metric.metadata?.taskId && `Task #${metric.metadata.taskId}`}
                          {metric.metadata?.toolName && metric.metadata.toolName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1a1a2e' }}>Execution Logs</h3>

            {logs.length === 0 ? (
              <p style={{ color: '#6c757d', textAlign: 'center', padding: '40px' }}>No logs available</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {logs.map((log, i) => (
                  <div key={i} style={{ border: '1px solid #e9ecef', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{
                      padding: '16px',
                      background: '#f8f9fa',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: statusColors[log.task?.status]?.bg || '#e9ecef',
                          color: statusColors[log.task?.status]?.color || '#495057'
                        }}>
                          {log.task?.status}
                        </span>
                        <span style={{ marginLeft: '12px', color: '#1a1a2e', fontWeight: '500' }}>
                          Task #{log.task?.id}
                        </span>
                      </div>
                      <span style={{ color: '#6c757d', fontSize: '13px' }}>
                        {formatDate(log.task?.created_at)}
                      </span>
                    </div>
                    <div style={{ padding: '16px' }}>
                      <p style={{ margin: '0 0 12px 0', color: '#1a1a2e' }}>
                        {log.task?.task_description}
                      </p>
                      {log.steps && log.steps.length > 0 && (
                        <div style={{ fontSize: '13px', color: '#6c757d' }}>
                          {log.steps.length} steps executed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1a1a2e' }}>Alerts & Warnings</h3>

            {(!analytics?.alerts || analytics.alerts.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <span style={{ fontSize: '48px' }}>✅</span>
                <p style={{ color: '#6c757d', marginTop: '12px' }}>No active alerts</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analytics.alerts.map((alert, i) => (
                  <div key={i} style={{
                    padding: '16px',
                    background: alert.severity === 'critical' ? '#fff5f5' : alert.severity === 'warning' ? '#fffbeb' : '#f8f9fa',
                    borderRadius: '12px',
                    borderLeft: `4px solid ${alert.severity === 'critical' ? '#f56565' : alert.severity === 'warning' ? '#ed8936' : '#4299e1'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '20px' }}>
                        {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟠' : '🔵'}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        background: alert.severity === 'critical' ? '#f5656520' : '#ed893620',
                        color: alert.severity === 'critical' ? '#f56565' : '#ed8936',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        {alert.severity}
                      </span>
                    </div>
                    <div style={{ fontWeight: '500', color: '#1a1a2e' }}>
                      {alert.message}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '4px' }}>
                      Type: {alert.type}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AgentMonitor;

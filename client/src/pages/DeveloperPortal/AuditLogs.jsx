/**
 * API Audit Logs Page
 * View and export API request/response audit trail
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AuditLogs = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    method: '',
    endpoint: '',
    statusCode: '',
    ipAddress: ''
  });
  const [stats, setStats] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [exporting, setExporting] = useState(false);

  const token = localStorage.getItem('token');

  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const statusCodeRanges = [
    { value: '', label: t('audit.allStatuses', 'All Statuses') },
    { value: '200-299', label: '2xx Success' },
    { value: '300-399', label: '3xx Redirect' },
    { value: '400-499', label: '4xx Client Error' },
    { value: '500-599', label: '5xx Server Error' }
  ];

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.method) params.append('method', filters.method);
      if (filters.endpoint) params.append('endpoint', filters.endpoint);
      if (filters.statusCode) params.append('statusCode', filters.statusCode);
      if (filters.ipAddress) params.append('ipAddress', filters.ipAddress);

      const response = await fetch(`${API_URL}/api/audit-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch audit logs');

      const data = await response.json();
      setLogs(data.logs || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }));
    } catch (err) {
      setError(err.message);
      // Use mock data for demo
      setLogs([
        {
          id: 1,
          method: 'GET',
          endpoint: '/api/bots',
          status_code: 200,
          response_time_ms: 45,
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          method: 'POST',
          endpoint: '/api/bots',
          status_code: 201,
          response_time_ms: 120,
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          created_at: new Date(Date.now() - 60000).toISOString()
        },
        {
          id: 3,
          method: 'GET',
          endpoint: '/api/conversations',
          status_code: 401,
          response_time_ms: 15,
          ip_address: '10.0.0.50',
          error_message: 'Unauthorized',
          created_at: new Date(Date.now() - 120000).toISOString()
        },
        {
          id: 4,
          method: 'DELETE',
          endpoint: '/api/bots/123',
          status_code: 500,
          response_time_ms: 250,
          ip_address: '192.168.1.100',
          error_message: 'Internal server error',
          created_at: new Date(Date.now() - 180000).toISOString()
        }
      ]);
      setPagination(prev => ({ ...prev, total: 4, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [token, pagination.page, pagination.limit, filters]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`${API_URL}/api/audit-logs/stats?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      // Use mock stats
      setStats({
        totalRequests: 1250,
        uniqueIps: 15,
        methodBreakdown: [
          { method: 'GET', count: 800 },
          { method: 'POST', count: 300 },
          { method: 'PUT', count: 100 },
          { method: 'DELETE', count: 50 }
        ],
        statusBreakdown: [
          { status_group: '2xx', count: 1100 },
          { status_group: '4xx', count: 120 },
          { status_group: '5xx', count: 30 }
        ],
        responseTime: {
          avg: 85,
          max: 2500,
          min: 5
        },
        topEndpoints: [
          { endpoint: '/api/bots', method: 'GET', count: 500, avg_time: 45 },
          { endpoint: '/api/conversations', method: 'GET', count: 300, avg_time: 120 },
          { endpoint: '/api/chat', method: 'POST', count: 200, avg_time: 250 }
        ]
      });
    }
  }, [token, filters.startDate, filters.endDate]);

  // Fetch log detail
  const fetchLogDetail = async (logId) => {
    try {
      const response = await fetch(`${API_URL}/api/audit-logs/${logId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch log detail');

      const data = await response.json();
      setSelectedLog(data.log);
      setShowDetailModal(true);
    } catch (err) {
      // Use mock detail
      const mockLog = logs.find(l => l.id === logId);
      setSelectedLog({
        ...mockLog,
        path_params: { id: '123' },
        query_params: { page: '1', limit: '50' },
        request_body: { name: 'Test Bot', description: 'A test bot' },
        request_headers: {
          'Content-Type': 'application/json',
          'User-Agent': mockLog?.user_agent,
          'Authorization': '[REDACTED]'
        }
      });
      setShowDetailModal(true);
    }
  };

  // Export logs
  const handleExport = async (format) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`${API_URL}/api/audit-logs/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(t('audit.exportFailed', 'Export failed: ') + err.message);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (showStatsPanel) {
      fetchStats();
    }
  }, [showStatsPanel, fetchStats]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getMethodColor = (method) => {
    const colors = {
      GET: '#10b981',
      POST: '#3b82f6',
      PUT: '#f59e0b',
      PATCH: '#8b5cf6',
      DELETE: '#ef4444'
    };
    return colors[method] || '#6b7280';
  };

  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return '#10b981';
    if (status >= 300 && status < 400) return '#3b82f6';
    if (status >= 400 && status < 500) return '#f59e0b';
    if (status >= 500) return '#ef4444';
    return '#6b7280';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('audit.title', 'API Audit Logs')}</h1>
          <p style={styles.subtitle}>
            {t('audit.subtitle', 'View and analyze your API request history')}
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.statsButton}
            onClick={() => setShowStatsPanel(!showStatsPanel)}
            aria-pressed={showStatsPanel}
            aria-label={t('audit.toggleStats', 'Toggle statistics panel')}
          >
            <BarChart3 size={14} style={{ display: 'inline', marginRight: '4px' }} />{t('audit.stats', 'Stats')}
          </button>
          <div style={styles.exportDropdown}>
            <button
              style={styles.exportButton}
              disabled={exporting}
              onClick={() => handleExport('json')}
              aria-label={t('audit.exportJson', 'Export as JSON')}
            >
              {exporting ? '...' : '📥'} JSON
            </button>
            <button
              style={styles.exportButton}
              disabled={exporting}
              onClick={() => handleExport('csv')}
              aria-label={t('audit.exportCsv', 'Export as CSV')}
            >
              {exporting ? '...' : '📥'} CSV
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner} role="alert">
          {t('audit.usingDemo', 'Using demo data. Connect to API for real logs.')}
        </div>
      )}

      {/* Stats Panel */}
      {showStatsPanel && stats && (
        <section style={styles.statsPanel} aria-labelledby="stats-heading">
          <h2 id="stats-heading" style={styles.statsPanelTitle}>
            {t('audit.statistics', 'Statistics')}
          </h2>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{stats.totalRequests?.toLocaleString()}</span>
              <span style={styles.statLabel}>{t('audit.totalRequests', 'Total Requests')}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{stats.uniqueIps}</span>
              <span style={styles.statLabel}>{t('audit.uniqueIps', 'Unique IPs')}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{stats.responseTime?.avg}ms</span>
              <span style={styles.statLabel}>{t('audit.avgResponseTime', 'Avg Response')}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{stats.responseTime?.max}ms</span>
              <span style={styles.statLabel}>{t('audit.maxResponseTime', 'Max Response')}</span>
            </div>
          </div>

          <div style={styles.statsCharts}>
            <div style={styles.chartSection}>
              <h3>{t('audit.byMethod', 'By Method')}</h3>
              <div style={styles.barChart}>
                {stats.methodBreakdown?.map(item => (
                  <div key={item.method} style={styles.barRow}>
                    <span style={{ ...styles.methodBadgeSmall, backgroundColor: getMethodColor(item.method) }}>
                      {item.method}
                    </span>
                    <div style={styles.barContainer}>
                      <div
                        style={{
                          ...styles.bar,
                          width: `${(item.count / stats.totalRequests) * 100}%`,
                          backgroundColor: getMethodColor(item.method)
                        }}
                      />
                    </div>
                    <span style={styles.barValue}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.chartSection}>
              <h3>{t('audit.byStatus', 'By Status')}</h3>
              <div style={styles.barChart}>
                {stats.statusBreakdown?.map(item => (
                  <div key={item.status_group} style={styles.barRow}>
                    <span style={styles.statusLabel}>{item.status_group}</span>
                    <div style={styles.barContainer}>
                      <div
                        style={{
                          ...styles.bar,
                          width: `${(item.count / stats.totalRequests) * 100}%`,
                          backgroundColor: item.status_group === '2xx' ? '#10b981' :
                            item.status_group === '4xx' ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </div>
                    <span style={styles.barValue}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      <section style={styles.filtersSection} aria-labelledby="filters-heading">
        <h2 id="filters-heading" className="sr-only">{t('audit.filters', 'Filters')}</h2>
        <div style={styles.filtersGrid}>
          <div style={styles.filterGroup}>
            <label htmlFor="filter-start-date" style={styles.filterLabel}>
              {t('audit.startDate', 'Start Date')}
            </label>
            <input
              id="filter-start-date"
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              style={styles.filterInput}
            />
          </div>

          <div style={styles.filterGroup}>
            <label htmlFor="filter-end-date" style={styles.filterLabel}>
              {t('audit.endDate', 'End Date')}
            </label>
            <input
              id="filter-end-date"
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              style={styles.filterInput}
            />
          </div>

          <div style={styles.filterGroup}>
            <label htmlFor="filter-method" style={styles.filterLabel}>
              {t('audit.method', 'Method')}
            </label>
            <select
              id="filter-method"
              value={filters.method}
              onChange={(e) => handleFilterChange('method', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">{t('audit.allMethods', 'All Methods')}</option>
              {methods.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label htmlFor="filter-status" style={styles.filterLabel}>
              {t('audit.statusCode', 'Status Code')}
            </label>
            <select
              id="filter-status"
              value={filters.statusCode}
              onChange={(e) => handleFilterChange('statusCode', e.target.value)}
              style={styles.filterSelect}
            >
              {statusCodeRanges.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label htmlFor="filter-endpoint" style={styles.filterLabel}>
              {t('audit.endpoint', 'Endpoint')}
            </label>
            <input
              id="filter-endpoint"
              type="text"
              value={filters.endpoint}
              onChange={(e) => handleFilterChange('endpoint', e.target.value)}
              placeholder="/api/..."
              style={styles.filterInput}
            />
          </div>

          <div style={styles.filterGroup}>
            <label htmlFor="filter-ip" style={styles.filterLabel}>
              {t('audit.ipAddress', 'IP Address')}
            </label>
            <input
              id="filter-ip"
              type="text"
              value={filters.ipAddress}
              onChange={(e) => handleFilterChange('ipAddress', e.target.value)}
              placeholder="192.168.1.1"
              style={styles.filterInput}
            />
          </div>
        </div>
      </section>

      {/* Logs Table */}
      <section style={styles.tableSection}>
        {loading ? (
          <div style={styles.loading} role="status" aria-busy="true">
            <div style={styles.spinner} aria-hidden="true" />
            <p>{t('common.loading', 'Loading...')}</p>
          </div>
        ) : (
          <>
            <div style={styles.tableContainer}>
              <table style={styles.table} aria-label={t('audit.logsTable', 'Audit logs table')}>
                <thead>
                  <tr>
                    <th scope="col" style={styles.th}>{t('audit.time', 'Time')}</th>
                    <th scope="col" style={styles.th}>{t('audit.method', 'Method')}</th>
                    <th scope="col" style={styles.th}>{t('audit.endpoint', 'Endpoint')}</th>
                    <th scope="col" style={styles.th}>{t('audit.status', 'Status')}</th>
                    <th scope="col" style={styles.th}>{t('audit.duration', 'Duration')}</th>
                    <th scope="col" style={styles.th}>{t('audit.ip', 'IP')}</th>
                    <th scope="col" style={styles.th}>{t('audit.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={styles.emptyCell}>
                        {t('audit.noLogs', 'No audit logs found')}
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id} style={styles.tr}>
                        <td style={styles.td}>
                          <span style={styles.timeCell}>{formatDate(log.created_at)}</span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.methodBadge,
                              backgroundColor: getMethodColor(log.method)
                            }}
                          >
                            {log.method}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.endpointCell}>{log.endpoint}</span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              backgroundColor: `${getStatusColor(log.status_code)}20`,
                              color: getStatusColor(log.status_code)
                            }}
                          >
                            {log.status_code}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.durationCell}>
                            {formatDuration(log.response_time_ms)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.ipCell}>{log.ip_address}</span>
                        </td>
                        <td style={styles.td}>
                          <button
                            style={styles.viewButton}
                            onClick={() => fetchLogDetail(log.id)}
                            aria-label={t('audit.viewDetails', 'View details')}
                          >
                            {t('audit.view', 'View')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <nav style={styles.pagination} aria-label={t('audit.pagination', 'Pagination')}>
                <button
                  style={styles.pageButton}
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  aria-label={t('audit.previousPage', 'Previous page')}
                >
                  ← {t('audit.prev', 'Prev')}
                </button>
                <span style={styles.pageInfo}>
                  {t('audit.pageOf', 'Page {{page}} of {{total}}', {
                    page: pagination.page,
                    total: pagination.totalPages
                  })}
                </span>
                <button
                  style={styles.pageButton}
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  aria-label={t('audit.nextPage', 'Next page')}
                >
                  {t('audit.next', 'Next')} →
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowDetailModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
        >
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 id="detail-modal-title" style={styles.modalTitle}>
                {t('audit.requestDetails', 'Request Details')}
              </h2>
              <button
                style={styles.closeButton}
                onClick={() => setShowDetailModal(false)}
                aria-label={t('common.close', 'Close')}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Request Info */}
              <div style={styles.detailSection}>
                <h3 style={styles.sectionTitle}>{t('audit.request', 'Request')}</h3>
                <div style={styles.detailRow}>
                  <span
                    style={{
                      ...styles.methodBadge,
                      backgroundColor: getMethodColor(selectedLog.method)
                    }}
                  >
                    {selectedLog.method}
                  </span>
                  <code style={styles.endpointCode}>{selectedLog.endpoint}</code>
                </div>

                {selectedLog.path_params && Object.keys(selectedLog.path_params).length > 0 && (
                  <div style={styles.codeBlock}>
                    <h4>{t('audit.pathParams', 'Path Parameters')}</h4>
                    <pre>{JSON.stringify(selectedLog.path_params, null, 2)}</pre>
                  </div>
                )}

                {selectedLog.query_params && Object.keys(selectedLog.query_params).length > 0 && (
                  <div style={styles.codeBlock}>
                    <h4>{t('audit.queryParams', 'Query Parameters')}</h4>
                    <pre>{JSON.stringify(selectedLog.query_params, null, 2)}</pre>
                  </div>
                )}

                {selectedLog.request_headers && (
                  <div style={styles.codeBlock}>
                    <h4>{t('audit.headers', 'Headers')}</h4>
                    <pre>{JSON.stringify(selectedLog.request_headers, null, 2)}</pre>
                  </div>
                )}

                {selectedLog.request_body && Object.keys(selectedLog.request_body).length > 0 && (
                  <div style={styles.codeBlock}>
                    <h4>{t('audit.body', 'Body')}</h4>
                    <pre>{JSON.stringify(selectedLog.request_body, null, 2)}</pre>
                  </div>
                )}
              </div>

              {/* Response Info */}
              <div style={styles.detailSection}>
                <h3 style={styles.sectionTitle}>{t('audit.response', 'Response')}</h3>
                <div style={styles.responseInfo}>
                  <div style={styles.responseItem}>
                    <span style={styles.responseLabel}>{t('audit.status', 'Status')}:</span>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: `${getStatusColor(selectedLog.status_code)}20`,
                        color: getStatusColor(selectedLog.status_code)
                      }}
                    >
                      {selectedLog.status_code}
                    </span>
                  </div>
                  <div style={styles.responseItem}>
                    <span style={styles.responseLabel}>{t('audit.time', 'Time')}:</span>
                    <span>{formatDuration(selectedLog.response_time_ms)}</span>
                  </div>
                  <div style={styles.responseItem}>
                    <span style={styles.responseLabel}>{t('audit.size', 'Size')}:</span>
                    <span>{selectedLog.response_size_bytes || 0} bytes</span>
                  </div>
                </div>

                {selectedLog.error_message && (
                  <div style={styles.errorBox}>
                    <strong>{t('audit.error', 'Error')}:</strong> {selectedLog.error_message}
                  </div>
                )}
              </div>

              {/* Context Info */}
              <div style={styles.detailSection}>
                <h3 style={styles.sectionTitle}>{t('audit.context', 'Context')}</h3>
                <div style={styles.contextGrid}>
                  <div style={styles.contextItem}>
                    <span style={styles.contextLabel}>{t('audit.ipAddress', 'IP Address')}</span>
                    <span>{selectedLog.ip_address}</span>
                  </div>
                  <div style={styles.contextItem}>
                    <span style={styles.contextLabel}>{t('audit.userAgent', 'User Agent')}</span>
                    <span style={styles.userAgentText}>{selectedLog.user_agent}</span>
                  </div>
                  <div style={styles.contextItem}>
                    <span style={styles.contextLabel}>{t('audit.timestamp', 'Timestamp')}</span>
                    <span>{formatDate(selectedLog.created_at)}</span>
                  </div>
                  {selectedLog.geo_country && (
                    <div style={styles.contextItem}>
                      <span style={styles.contextLabel}>{t('audit.location', 'Location')}</span>
                      <span>{selectedLog.geo_city}, {selectedLog.geo_country}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  subtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#6b7280'
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  statsButton: {
    padding: '10px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  exportDropdown: {
    display: 'flex',
    gap: '8px'
  },
  exportButton: {
    padding: '10px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  errorBanner: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '24px'
  },
  statsPanel: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  statsPanelTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
    textAlign: 'center'
  },
  statValue: {
    display: 'block',
    fontSize: '28px',
    fontWeight: '700',
    color: '#3b82f6'
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase'
  },
  statsCharts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px'
  },
  chartSection: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px'
  },
  barChart: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  barContainer: {
    flex: 1,
    height: '20px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  bar: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s'
  },
  barValue: {
    fontSize: '12px',
    color: '#6b7280',
    minWidth: '40px',
    textAlign: 'right'
  },
  methodBadgeSmall: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    color: 'white',
    minWidth: '45px',
    textAlign: 'center'
  },
  statusLabel: {
    fontSize: '12px',
    color: '#374151',
    minWidth: '30px'
  },
  filtersSection: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  filterLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151'
  },
  filterInput: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  filterSelect: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  tableSection: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    overflow: 'hidden'
  },
  tableContainer: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '14px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb'
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.15s'
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#374151'
  },
  emptyCell: {
    padding: '40px',
    textAlign: 'center',
    color: '#6b7280'
  },
  timeCell: {
    fontSize: '13px',
    color: '#6b7280'
  },
  methodBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    color: 'white'
  },
  endpointCell: {
    fontFamily: 'monospace',
    fontSize: '13px'
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600'
  },
  durationCell: {
    fontSize: '13px',
    color: '#6b7280'
  },
  ipCell: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#6b7280'
  },
  viewButton: {
    padding: '6px 12px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    borderTop: '1px solid #e5e7eb'
  },
  pageButton: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  pageInfo: {
    fontSize: '14px',
    color: '#6b7280'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb'
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  closeButton: {
    width: '32px',
    height: '32px',
    border: 'none',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto'
  },
  detailSection: {
    marginBottom: '24px'
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase'
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  endpointCode: {
    backgroundColor: '#f3f4f6',
    padding: '6px 12px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '14px'
  },
  codeBlock: {
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px'
  },
  responseInfo: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap'
  },
  responseItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  responseLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '12px 16px',
    borderRadius: '8px',
    marginTop: '12px',
    fontSize: '14px'
  },
  contextGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px'
  },
  contextItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  contextLabel: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase'
  },
  userAgentText: {
    fontSize: '12px',
    wordBreak: 'break-all'
  }
};

export default AuditLogs;

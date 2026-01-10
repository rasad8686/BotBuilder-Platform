import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BarChart3, Clock, XCircle, DollarSign, TrendingUp, PieChart as PieChartIcon, Flame, ChevronDown } from 'lucide-react';

const API_BASE = '/api/analytics/pro';

// Widget types for dashboard builder
const WIDGET_TYPES = {
  requests: { label: 'Requests', Icon: BarChart3, color: '#3b82f6' },
  latency: { label: 'Latency', Icon: Clock, color: '#10b981' },
  errors: { label: 'Errors', Icon: XCircle, color: '#ef4444' },
  cost: { label: 'Cost', Icon: DollarSign, color: '#f59e0b' }
};

const CHART_TYPES = [
  { value: 'line', label: 'Line Chart', Icon: TrendingUp },
  { value: 'bar', label: 'Bar Chart', Icon: BarChart3 },
  { value: 'pie', label: 'Pie Chart', Icon: PieChartIcon },
  { value: 'heatmap', label: 'Heatmap', Icon: Flame },
  { value: 'funnel', label: 'Funnel', Icon: ChevronDown }
];

const DIMENSIONS = [
  { value: 'time', label: 'Time' },
  { value: 'hour', label: 'Hourly' },
  { value: 'endpoint', label: 'Endpoint' },
  { value: 'region', label: 'Region' },
  { value: 'token', label: 'API Token' }
];

const TIME_PERIODS = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' }
];

const SCHEDULES = [
  { value: '', label: 'No Schedule' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

const SEVERITIES = {
  low: { color: '#22c55e', bg: '#dcfce7' },
  medium: { color: '#f59e0b', bg: '#fef3c7' },
  high: { color: '#f97316', bg: '#ffedd5' },
  critical: { color: '#ef4444', bg: '#fee2e2' }
};

function AnalyticsPro() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [reports, setReports] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Dashboard builder state
  const [widgets, setWidgets] = useState([
    { id: 1, metric: 'requests', chartType: 'line', dimension: 'time' },
    { id: 2, metric: 'latency', chartType: 'line', dimension: 'time' },
    { id: 3, metric: 'errors', chartType: 'bar', dimension: 'time' },
    { id: 4, metric: 'cost', chartType: 'line', dimension: 'time' }
  ]);
  const [draggedWidget, setDraggedWidget] = useState(null);

  // Metrics builder state
  const [metricsConfig, setMetricsConfig] = useState({
    metrics: ['requests'],
    dimensions: ['time'],
    period: '7d'
  });
  const [metricsData, setMetricsData] = useState(null);

  // Report builder state
  const [reportForm, setReportForm] = useState({
    name: '',
    description: '',
    report_type: 'usage',
    config: { metrics: ['requests'], dimensions: ['time'], timeRange: { period: '7d' } },
    schedule: ''
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportResult, setReportResult] = useState(null);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/dashboard`, {
        params: { period: '7d' }
      });
      setDashboardData(response.data.data);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/reports`);
      setReports(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    }
  }, []);

  // Fetch anomalies
  const fetchAnomalies = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/anomalies`, {
        params: { acknowledged: 'false', limit: 20 }
      });
      setAnomalies(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchReports();
    fetchAnomalies();
  }, [fetchDashboard, fetchReports, fetchAnomalies]);

  // Calculate metrics
  const calculateMetrics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/metrics`, {
        params: {
          metrics: metricsConfig.metrics.join(','),
          dimensions: metricsConfig.dimensions.join(','),
          period: metricsConfig.period
        }
      });
      setMetricsData(response.data.data);
    } catch (err) {
      setError('Failed to calculate metrics');
    } finally {
      setLoading(false);
    }
  };

  // Create report
  const createReport = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/reports`, reportForm);
      fetchReports();
      setReportForm({
        name: '',
        description: '',
        report_type: 'usage',
        config: { metrics: ['requests'], dimensions: ['time'], timeRange: { period: '7d' } },
        schedule: ''
      });
    } catch (err) {
      setError('Failed to create report');
    } finally {
      setLoading(false);
    }
  };

  // Run report
  const runReport = async (reportId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/reports/${reportId}/run`);
      setReportResult(response.data.data);
      setSelectedReport(reportId);
    } catch (err) {
      setError('Failed to run report');
    } finally {
      setLoading(false);
    }
  };

  // Export report
  const exportReport = async (reportId, format) => {
    try {
      const response = await axios.get(`${API_BASE}/reports/${reportId}/export`, {
        params: { format },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${reportId}.${format === 'pdf' ? 'html' : format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export report');
    }
  };

  // Delete report
  const deleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      await axios.delete(`${API_BASE}/reports/${reportId}`);
      fetchReports();
      if (selectedReport === reportId) {
        setSelectedReport(null);
        setReportResult(null);
      }
    } catch (err) {
      setError('Failed to delete report');
    }
  };

  // Schedule report
  const scheduleReport = async (reportId, schedule) => {
    try {
      await axios.post(`${API_BASE}/reports/${reportId}/schedule`, { schedule });
      fetchReports();
    } catch (err) {
      setError('Failed to schedule report');
    }
  };

  // Acknowledge anomaly
  const acknowledgeAnomaly = async (anomalyId) => {
    try {
      await axios.post(`${API_BASE}/anomalies/${anomalyId}/acknowledge`);
      fetchAnomalies();
    } catch (err) {
      setError('Failed to acknowledge anomaly');
    }
  };

  // Detect anomalies
  const detectAnomalies = async (metric) => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/anomalies/detect`, {
        metric,
        method: 'zscore',
        threshold: 3,
        lookbackDays: 30
      });
      fetchAnomalies();
    } catch (err) {
      setError('Failed to detect anomalies');
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (widget) => {
    setDraggedWidget(widget);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (targetWidget) => {
    if (!draggedWidget || draggedWidget.id === targetWidget.id) return;

    const newWidgets = [...widgets];
    const draggedIndex = widgets.findIndex(w => w.id === draggedWidget.id);
    const targetIndex = widgets.findIndex(w => w.id === targetWidget.id);

    newWidgets.splice(draggedIndex, 1);
    newWidgets.splice(targetIndex, 0, draggedWidget);

    setWidgets(newWidgets);
    setDraggedWidget(null);
  };

  // Update widget config
  const updateWidget = (widgetId, field, value) => {
    setWidgets(widgets.map(w =>
      w.id === widgetId ? { ...w, [field]: value } : w
    ));
  };

  // Add new widget
  const addWidget = () => {
    const newId = Math.max(...widgets.map(w => w.id), 0) + 1;
    setWidgets([...widgets, {
      id: newId,
      metric: 'requests',
      chartType: 'line',
      dimension: 'time'
    }]);
  };

  // Remove widget
  const removeWidget = (widgetId) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
  };

  // Render metric value
  const renderMetricValue = (metric, data) => {
    if (!data || !data.summary) return 'N/A';
    const summary = data.summary;

    switch (metric) {
      case 'requests':
        return `${summary.total?.toLocaleString() || 0} requests`;
      case 'latency':
        return `${summary.avgLatency?.toFixed(2) || 0} ms avg`;
      case 'errors':
        return `${summary.totalErrors?.toLocaleString() || 0} errors`;
      case 'cost':
        return `$${summary.totalCost?.toFixed(2) || 0}`;
      default:
        return 'N/A';
    }
  };

  // Render simple chart visualization
  const renderChart = (data, chartType) => {
    if (!data || !data.data || data.data.length === 0) {
      return <div style={styles.noData}>No data available</div>;
    }

    const maxValue = Math.max(...data.data.map(d =>
      d.total_requests || d.avg_latency || d.error_count || d.total_cost || 0
    ));

    if (chartType === 'bar') {
      return (
        <div style={styles.barChart}>
          {data.data.slice(0, 10).map((item, idx) => {
            const value = item.total_requests || item.avg_latency || item.error_count || item.total_cost || 0;
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return (
              <div key={idx} style={styles.barContainer}>
                <div style={{ ...styles.bar, height: `${height}%` }} title={value} />
                <span style={styles.barLabel}>{item.time_period?.substring(5, 10) || idx + 1}</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (chartType === 'pie') {
      const total = data.data.reduce((sum, d) =>
        sum + (d.total_requests || d.error_count || 0), 0
      );
      return (
        <div style={styles.pieChart}>
          {data.data.slice(0, 5).map((item, idx) => {
            const value = item.total_requests || item.error_count || 0;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
            return (
              <div key={idx} style={styles.pieSlice}>
                <div style={{ ...styles.pieColor, backgroundColor: colors[idx % colors.length] }} />
                <span>{item.time_period || item.endpoint || `Item ${idx + 1}`}: {percentage}%</span>
              </div>
            );
          })}
        </div>
      );
    }

    // Line chart (default)
    return (
      <div style={styles.lineChart}>
        <svg viewBox="0 0 300 100" style={styles.svg}>
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={data.data.slice(0, 20).map((item, idx) => {
              const value = item.total_requests || item.avg_latency || item.error_count || item.total_cost || 0;
              const x = (idx / Math.max(data.data.length - 1, 1)) * 280 + 10;
              const y = maxValue > 0 ? 90 - (value / maxValue) * 80 : 50;
              return `${x},${y}`;
            }).join(' ')}
          />
        </svg>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Analytics Pro</h1>
        <p style={styles.subtitle}>Advanced analytics, custom reports, and anomaly detection</p>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError(null)} style={styles.dismissBtn}>Dismiss</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        {['dashboard', 'metrics', 'reports', 'anomalies'].map(tab => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.activeTab : {})
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Custom Dashboard</h2>
            <button onClick={addWidget} style={styles.addBtn}>+ Add Widget</button>
          </div>

          <div style={styles.widgetGrid}>
            {widgets.map(widget => (
              <div
                key={widget.id}
                style={{
                  ...styles.widget,
                  borderColor: WIDGET_TYPES[widget.metric]?.color || '#e5e7eb'
                }}
                draggable
                onDragStart={() => handleDragStart(widget)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(widget)}
              >
                <div style={styles.widgetHeader}>
                  <span style={styles.widgetIcon}>{(() => { const Icon = WIDGET_TYPES[widget.metric]?.Icon; return Icon ? <Icon size={20} /> : null; })()}</span>
                  <select
                    value={widget.metric}
                    onChange={(e) => updateWidget(widget.id, 'metric', e.target.value)}
                    style={styles.select}
                  >
                    {Object.entries(WIDGET_TYPES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeWidget(widget.id)}
                    style={styles.removeBtn}
                    title="Remove widget"
                  >
                    x
                  </button>
                </div>

                <div style={styles.widgetControls}>
                  <select
                    value={widget.chartType}
                    onChange={(e) => updateWidget(widget.id, 'chartType', e.target.value)}
                    style={styles.selectSmall}
                  >
                    {CHART_TYPES.map(ct => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                  <select
                    value={widget.dimension}
                    onChange={(e) => updateWidget(widget.id, 'dimension', e.target.value)}
                    style={styles.selectSmall}
                  >
                    {DIMENSIONS.map(dim => (
                      <option key={dim.value} value={dim.value}>{dim.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.widgetValue}>
                  {dashboardData?.metrics?.[widget.metric] ?
                    renderMetricValue(widget.metric, dashboardData.metrics[widget.metric]) :
                    'Loading...'
                  }
                </div>

                <div style={styles.widgetChart}>
                  {dashboardData?.metrics?.[widget.metric] &&
                    renderChart(dashboardData.metrics[widget.metric], widget.chartType)
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Builder Tab */}
      {activeTab === 'metrics' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Custom Metrics Builder</h2>

          <div style={styles.metricsBuilder}>
            <div style={styles.builderRow}>
              <label style={styles.label}>Metrics:</label>
              <div style={styles.checkboxGroup}>
                {Object.entries(WIDGET_TYPES).map(([key, val]) => (
                  <label key={key} style={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={metricsConfig.metrics.includes(key)}
                      onChange={(e) => {
                        const newMetrics = e.target.checked
                          ? [...metricsConfig.metrics, key]
                          : metricsConfig.metrics.filter(m => m !== key);
                        setMetricsConfig({ ...metricsConfig, metrics: newMetrics });
                      }}
                    />
                    {val.Icon && <val.Icon size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />}{val.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={styles.builderRow}>
              <label style={styles.label}>Dimensions:</label>
              <div style={styles.checkboxGroup}>
                {DIMENSIONS.map(dim => (
                  <label key={dim.value} style={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={metricsConfig.dimensions.includes(dim.value)}
                      onChange={(e) => {
                        const newDims = e.target.checked
                          ? [...metricsConfig.dimensions, dim.value]
                          : metricsConfig.dimensions.filter(d => d !== dim.value);
                        setMetricsConfig({ ...metricsConfig, dimensions: newDims });
                      }}
                    />
                    {dim.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={styles.builderRow}>
              <label style={styles.label}>Time Period:</label>
              <select
                value={metricsConfig.period}
                onChange={(e) => setMetricsConfig({ ...metricsConfig, period: e.target.value })}
                style={styles.select}
              >
                {TIME_PERIODS.map(tp => (
                  <option key={tp.value} value={tp.value}>{tp.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={calculateMetrics}
              disabled={loading || metricsConfig.metrics.length === 0}
              style={styles.primaryBtn}
            >
              {loading ? 'Calculating...' : 'Calculate Metrics'}
            </button>
          </div>

          {metricsData && (
            <div style={styles.metricsResults}>
              <h3 style={styles.resultsTitle}>Results</h3>
              {Object.entries(metricsData).map(([metric, data]) => (
                <div key={metric} style={styles.metricResult}>
                  <h4 style={styles.metricName}>{WIDGET_TYPES[metric]?.icon} {WIDGET_TYPES[metric]?.label}</h4>
                  <div style={styles.summaryGrid}>
                    {data.summary && Object.entries(data.summary).map(([key, value]) => (
                      <div key={key} style={styles.summaryItem}>
                        <span style={styles.summaryLabel}>{key}:</span>
                        <span style={styles.summaryValue}>
                          {typeof value === 'object' ? JSON.stringify(value) : value?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Custom Reports</h2>

          <div style={styles.reportsGrid}>
            {/* Report Builder */}
            <div style={styles.reportBuilder}>
              <h3 style={styles.builderTitle}>Create New Report</h3>

              <div style={styles.formGroup}>
                <label style={styles.label}>Report Name:</label>
                <input
                  type="text"
                  value={reportForm.name}
                  onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                  style={styles.input}
                  placeholder="Monthly Usage Report"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description:</label>
                <textarea
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  style={styles.textarea}
                  placeholder="Describe what this report tracks..."
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Report Type:</label>
                <select
                  value={reportForm.report_type}
                  onChange={(e) => setReportForm({ ...reportForm, report_type: e.target.value })}
                  style={styles.select}
                >
                  <option value="usage">Usage Report</option>
                  <option value="performance">Performance Report</option>
                  <option value="errors">Error Report</option>
                  <option value="custom">Custom Report</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Schedule:</label>
                <select
                  value={reportForm.schedule}
                  onChange={(e) => setReportForm({ ...reportForm, schedule: e.target.value })}
                  style={styles.select}
                >
                  {SCHEDULES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={createReport}
                disabled={loading || !reportForm.name}
                style={styles.primaryBtn}
              >
                {loading ? 'Creating...' : 'Create Report'}
              </button>
            </div>

            {/* Reports List */}
            <div style={styles.reportsList}>
              <h3 style={styles.builderTitle}>Saved Reports</h3>

              {reports.length === 0 ? (
                <p style={styles.noData}>No reports created yet</p>
              ) : (
                reports.map(report => (
                  <div
                    key={report.id}
                    style={{
                      ...styles.reportCard,
                      ...(selectedReport === report.id ? styles.selectedReport : {})
                    }}
                  >
                    <div style={styles.reportHeader}>
                      <strong>{report.name}</strong>
                      <span style={styles.reportType}>{report.report_type}</span>
                    </div>
                    {report.description && (
                      <p style={styles.reportDesc}>{report.description}</p>
                    )}
                    <div style={styles.reportMeta}>
                      {report.schedule && (
                        <span style={styles.scheduleBadge}>
                          {report.schedule}
                        </span>
                      )}
                      {report.last_run_at && (
                        <span style={styles.lastRun}>
                          Last run: {new Date(report.last_run_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div style={styles.reportActions}>
                      <button
                        onClick={() => runReport(report.id)}
                        style={styles.actionBtn}
                      >
                        Run
                      </button>
                      <button
                        onClick={() => exportReport(report.id, 'csv')}
                        style={styles.actionBtn}
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => exportReport(report.id, 'pdf')}
                        style={styles.actionBtn}
                      >
                        PDF
                      </button>
                      <select
                        value={report.schedule || ''}
                        onChange={(e) => scheduleReport(report.id, e.target.value || null)}
                        style={styles.selectSmall}
                      >
                        {SCHEDULES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteReport(report.id)}
                        style={styles.deleteBtn}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Report Results */}
          {reportResult && (
            <div style={styles.reportResults}>
              <h3 style={styles.resultsTitle}>Report Results: {reportResult.name}</h3>
              <p style={styles.reportGenTime}>Generated: {reportResult.generated_at}</p>

              {reportResult.metrics && Object.entries(reportResult.metrics).map(([metric, data]) => (
                <div key={metric} style={styles.metricResult}>
                  <h4>{WIDGET_TYPES[metric]?.icon} {WIDGET_TYPES[metric]?.label}</h4>
                  {renderChart(data, 'bar')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Anomalies Tab */}
      {activeTab === 'anomalies' && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Anomaly Detection</h2>
            <div style={styles.detectButtons}>
              {Object.entries(WIDGET_TYPES).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => detectAnomalies(key)}
                  style={{ ...styles.detectBtn, borderColor: val.color }}
                  disabled={loading}
                >
                  {val.icon} Detect {val.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.anomalyList}>
            {anomalies.length === 0 ? (
              <div style={styles.noAnomalies}>
                <p>No anomalies detected</p>
                <span>Run anomaly detection to find unusual patterns in your data</span>
              </div>
            ) : (
              anomalies.map(anomaly => (
                <div
                  key={anomaly.id}
                  style={{
                    ...styles.anomalyCard,
                    borderLeftColor: SEVERITIES[anomaly.severity]?.color || '#gray'
                  }}
                >
                  <div style={styles.anomalyHeader}>
                    <span style={styles.metricBadge}>
                      {WIDGET_TYPES[anomaly.metric_name]?.icon} {anomaly.metric_name}
                    </span>
                    <span style={{
                      ...styles.severityBadge,
                      backgroundColor: SEVERITIES[anomaly.severity]?.bg,
                      color: SEVERITIES[anomaly.severity]?.color
                    }}>
                      {anomaly.severity}
                    </span>
                  </div>

                  <div style={styles.anomalyDetails}>
                    <div style={styles.anomalyRow}>
                      <span>Expected:</span>
                      <strong>{parseFloat(anomaly.expected_value).toFixed(2)}</strong>
                    </div>
                    <div style={styles.anomalyRow}>
                      <span>Actual:</span>
                      <strong>{parseFloat(anomaly.actual_value).toFixed(2)}</strong>
                    </div>
                    <div style={styles.anomalyRow}>
                      <span>Deviation:</span>
                      <strong style={{
                        color: anomaly.deviation_percent > 0 ? '#ef4444' : '#22c55e'
                      }}>
                        {anomaly.deviation_percent > 0 ? '+' : ''}{parseFloat(anomaly.deviation_percent).toFixed(1)}%
                      </strong>
                    </div>
                  </div>

                  <div style={styles.anomalyFooter}>
                    <span style={styles.detectedAt}>
                      Detected: {new Date(anomaly.detected_at).toLocaleString()}
                    </span>
                    <button
                      onClick={() => acknowledgeAnomaly(anomaly.id)}
                      style={styles.ackBtn}
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {loading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  subtitle: {
    color: '#6b7280',
    marginTop: '4px'
  },
  error: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    cursor: 'pointer',
    fontWeight: '500'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '8px'
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  activeTab: {
    backgroundColor: '#3b82f6',
    color: 'white'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: 0
  },
  addBtn: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  widgetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px'
  },
  widget: {
    backgroundColor: '#f9fafb',
    borderRadius: '10px',
    padding: '16px',
    border: '2px solid #e5e7eb',
    cursor: 'grab',
    transition: 'box-shadow 0.2s'
  },
  widgetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px'
  },
  widgetIcon: {
    fontSize: '20px'
  },
  widgetControls: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  widgetValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '12px'
  },
  widgetChart: {
    height: '100px',
    backgroundColor: 'white',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  select: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  selectSmall: {
    padding: '4px 8px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: 'white'
  },
  removeBtn: {
    marginLeft: 'auto',
    width: '24px',
    height: '24px',
    border: 'none',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  metricsBuilder: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '24px'
  },
  builderRow: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px'
  },
  checkboxGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer'
  },
  primaryBtn: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px'
  },
  metricsResults: {
    marginTop: '24px'
  },
  resultsTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '16px'
  },
  metricResult: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '12px'
  },
  metricName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px'
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'capitalize'
  },
  summaryValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827'
  },
  reportsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px'
  },
  reportBuilder: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '8px'
  },
  builderTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '16px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    minHeight: '80px',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  reportsList: {
    maxHeight: '500px',
    overflowY: 'auto'
  },
  reportCard: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '12px',
    border: '1px solid #e5e7eb'
  },
  selectedReport: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff'
  },
  reportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  reportType: {
    fontSize: '12px',
    padding: '2px 8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    color: '#4b5563'
  },
  reportDesc: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '8px'
  },
  reportMeta: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  scheduleBadge: {
    fontSize: '11px',
    padding: '2px 6px',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '4px'
  },
  lastRun: {
    fontSize: '11px',
    color: '#9ca3af'
  },
  reportActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  actionBtn: {
    padding: '6px 12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  deleteBtn: {
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  reportResults: {
    marginTop: '24px',
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '8px'
  },
  reportGenTime: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '16px'
  },
  detectButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  detectBtn: {
    padding: '8px 16px',
    backgroundColor: 'white',
    border: '2px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  anomalyList: {
    display: 'grid',
    gap: '12px'
  },
  noAnomalies: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  anomalyCard: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
    borderLeft: '4px solid',
    border: '1px solid #e5e7eb'
  },
  anomalyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  metricBadge: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151'
  },
  severityBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  anomalyDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '12px'
  },
  anomalyRow: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '13px'
  },
  anomalyFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid #e5e7eb'
  },
  detectedAt: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  ackBtn: {
    padding: '6px 12px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  noData: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
    fontSize: '13px'
  },
  barChart: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: '100%',
    padding: '8px'
  },
  barContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1
  },
  bar: {
    width: '80%',
    backgroundColor: '#3b82f6',
    borderRadius: '2px 2px 0 0',
    minHeight: '2px'
  },
  barLabel: {
    fontSize: '9px',
    color: '#9ca3af',
    marginTop: '4px'
  },
  pieChart: {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  pieSlice: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px'
  },
  pieColor: {
    width: '12px',
    height: '12px',
    borderRadius: '2px'
  },
  lineChart: {
    height: '100%',
    padding: '4px'
  },
  svg: {
    width: '100%',
    height: '100%'
  },
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};

export default AnalyticsPro;

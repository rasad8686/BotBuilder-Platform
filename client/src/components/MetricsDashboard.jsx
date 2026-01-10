/**
 * Metrics Dashboard Component
 *
 * Displays training metrics with Recharts:
 * - Loss Chart (LineChart)
 * - Accuracy Chart (LineChart)
 * - Summary Cards
 * - Model Comparison (BarChart)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingDown, Target, BarChart3, Clock, DollarSign, Trophy } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../utils/api';

export default function MetricsDashboard({ modelId, onClose, compareModelIds = [] }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [summary, setSummary] = useState(null);
  const [lossHistory, setLossHistory] = useState([]);
  const [accuracyHistory, setAccuracyHistory] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [exporting, setExporting] = useState(false);
  const hasFetched = useRef(false);

  // Fetch metrics data
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, lossRes, accuracyRes] = await Promise.all([
        api.get(`/api/fine-tuning/models/${modelId}/metrics/summary`),
        api.get(`/api/fine-tuning/models/${modelId}/metrics/loss`),
        api.get(`/api/fine-tuning/models/${modelId}/metrics/accuracy`)
      ]);

      setSummary(summaryRes.data.data);
      setLossHistory(lossRes.data.data || []);
      setAccuracyHistory(accuracyRes.data.data || []);

      // Fetch comparison if multiple models
      if (compareModelIds.length > 0) {
        const ids = [modelId, ...compareModelIds].join(',');
        const compareRes = await api.get(`/api/fine-tuning/compare?ids=${ids}`);
        setComparisonData(compareRes.data.data || []);
      }
    } catch (err) {
      // Failed to fetch metrics - silent fail
      setError(err.response?.data?.error || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  useEffect(() => {
    if (modelId && !hasFetched.current) {
      hasFetched.current = true;
      fetchMetrics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // Export handlers
  const handleExport = async (format) => {
    try {
      setExporting(true);
      const response = await api.get(
        `/api/fine-tuning/models/${modelId}/metrics/export?format=${format}`,
        { responseType: format === 'csv' ? 'blob' : 'json' }
      );

      if (format === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `metrics-model-${modelId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `metrics-model-${modelId}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      // Export failed - silent fail
    } finally {
      setExporting(false);
    }
  };

  // Generate mock data for demo
  const handleGenerateMock = async () => {
    try {
      setLoading(true);
      await api.post(`/api/fine-tuning/models/${modelId}/metrics/generate-mock`);
      await fetchMetrics();
    } catch (err) {
      // Failed to generate mock data - silent fail
    }
  };

  if (loading) {
    return (
      <div className="metrics-dashboard loading" role="status" aria-busy="true" aria-label="Loading metrics">
        <div className="loading-spinner" aria-hidden="true"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="metrics-dashboard error" role="alert">
        <p className="error-message">{error}</p>
        <button onClick={fetchMetrics} className="btn btn-secondary">
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="metrics-dashboard">
      {/* Header */}
      <div className="metrics-header">
        <h2>{t('fineTuning.metrics.title', 'Training Metrics')}</h2>
        <div className="metrics-actions">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="btn btn-outline"
          >
            {t('fineTuning.metrics.exportCSV', 'Export CSV')}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="btn btn-outline"
          >
            {t('fineTuning.metrics.exportJSON', 'Export JSON')}
          </button>
          {onClose && (
            <button onClick={onClose} className="btn btn-secondary">
              {t('common.close')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="metrics-tabs" role="tablist" aria-label="Metrics navigation">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          role="tab"
          aria-selected={activeTab === 'overview'}
          aria-controls="panel-overview"
        >
          {t('fineTuning.metrics.overview', 'Overview')}
        </button>
        <button
          className={`tab ${activeTab === 'loss' ? 'active' : ''}`}
          onClick={() => setActiveTab('loss')}
          role="tab"
          aria-selected={activeTab === 'loss'}
          aria-controls="panel-loss"
        >
          {t('fineTuning.metrics.lossChart', 'Loss')}
        </button>
        <button
          className={`tab ${activeTab === 'accuracy' ? 'active' : ''}`}
          onClick={() => setActiveTab('accuracy')}
          role="tab"
          aria-selected={activeTab === 'accuracy'}
          aria-controls="panel-accuracy"
        >
          {t('fineTuning.metrics.accuracyChart', 'Accuracy')}
        </button>
        {comparisonData.length > 1 && (
          <button
            className={`tab ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
            role="tab"
            aria-selected={activeTab === 'compare'}
            aria-controls="panel-compare"
          >
            {t('fineTuning.metrics.compare', 'Compare')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="metrics-content">
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" hidden={activeTab !== 'overview'}>
          {activeTab === 'overview' && <OverviewTab summary={summary} onGenerateMock={handleGenerateMock} t={t} />}
        </div>
        <div id="panel-loss" role="tabpanel" aria-labelledby="tab-loss" hidden={activeTab !== 'loss'}>
          {activeTab === 'loss' && <LossChartTab data={lossHistory} t={t} />}
        </div>
        <div id="panel-accuracy" role="tabpanel" aria-labelledby="tab-accuracy" hidden={activeTab !== 'accuracy'}>
          {activeTab === 'accuracy' && <AccuracyChartTab data={accuracyHistory} t={t} />}
        </div>
        <div id="panel-compare" role="tabpanel" aria-labelledby="tab-compare" hidden={activeTab !== 'compare'}>
          {activeTab === 'compare' && <ComparisonTab data={comparisonData} t={t} />}
        </div>
      </div>
    </div>
  );
}

// Overview Tab with Summary Cards
function OverviewTab({ summary, onGenerateMock, t }) {
  if (!summary || summary.totalSteps === 0) {
    return (
      <div className="no-data">
        <p>{t('fineTuning.metrics.noData', 'No metrics data available yet.')}</p>
        <button onClick={onGenerateMock} className="btn btn-primary">
          {t('fineTuning.metrics.generateMock', 'Generate Demo Data')}
        </button>
      </div>
    );
  }

  const cards = [
    {
      label: t('fineTuning.metrics.finalLoss', 'Final Loss'),
      value: summary.finalLoss?.train?.toFixed(4) || 'N/A',
      subValue: `Valid: ${summary.finalLoss?.valid?.toFixed(4) || 'N/A'}`,
      Icon: TrendingDown
    },
    {
      label: t('fineTuning.metrics.finalAccuracy', 'Final Accuracy'),
      value: summary.finalAccuracy?.train ? `${(summary.finalAccuracy.train * 100).toFixed(1)}%` : 'N/A',
      subValue: `Valid: ${summary.finalAccuracy?.valid ? `${(summary.finalAccuracy.valid * 100).toFixed(1)}%` : 'N/A'}`,
      Icon: Target
    },
    {
      label: t('fineTuning.metrics.totalTokens', 'Tokens Processed'),
      value: summary.totalTokens?.toLocaleString() || '0',
      subValue: `${summary.totalSteps} steps`,
      Icon: BarChart3
    },
    {
      label: t('fineTuning.metrics.trainingTime', 'Training Time'),
      value: summary.trainingTime ? `${summary.trainingTime} min` : 'N/A',
      subValue: `${summary.totalEpochs} epochs`,
      Icon: Clock
    },
    {
      label: t('fineTuning.metrics.trainingCost', 'Training Cost'),
      value: summary.trainingCost ? `$${summary.trainingCost.toFixed(2)}` : 'N/A',
      subValue: '',
      Icon: DollarSign
    },
    {
      label: t('fineTuning.metrics.bestLoss', 'Best Loss'),
      value: summary.bestLoss?.train?.toFixed(4) || 'N/A',
      subValue: `Valid: ${summary.bestLoss?.valid?.toFixed(4) || 'N/A'}`,
      Icon: Trophy
    }
  ];

  return (
    <div className="overview-tab">
      <div className="summary-cards">
        {cards.map((card, index) => (
          <div key={index} className="summary-card">
            <div className="card-icon">{card.Icon && <card.Icon size={24} />}</div>
            <div className="card-content">
              <div className="card-value">{card.value}</div>
              <div className="card-label">{card.label}</div>
              {card.subValue && <div className="card-subvalue">{card.subValue}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Mini charts */}
      <div className="mini-charts">
        <div className="mini-chart">
          <h4>{t('fineTuning.metrics.lossOverview', 'Loss Overview')}</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={summary.modelMetrics?.lossHistory || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="step" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="trainLoss"
                stroke="#3b82f6"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Loss Chart Tab
function LossChartTab({ data, t }) {
  if (!data || data.length === 0) {
    return (
      <div className="no-data">
        <p>{t('fineTuning.metrics.noLossData', 'No loss data available.')}</p>
      </div>
    );
  }

  return (
    <div className="chart-tab">
      <h3>{t('fineTuning.metrics.lossHistory', 'Loss History')}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="step"
            label={{ value: 'Step', position: 'bottom', offset: -5 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'Loss', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(value) => value?.toFixed(6)}
            labelFormatter={(label) => `Step ${label}`}
          />
          <Legend verticalAlign="top" height={36} />
          <Line
            type="monotone"
            dataKey="trainLoss"
            name={t('fineTuning.metrics.trainLoss', 'Training Loss')}
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="validLoss"
            name={t('fineTuning.metrics.validLoss', 'Validation Loss')}
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Accuracy Chart Tab
function AccuracyChartTab({ data, t }) {
  if (!data || data.length === 0) {
    return (
      <div className="no-data">
        <p>{t('fineTuning.metrics.noAccuracyData', 'No accuracy data available.')}</p>
      </div>
    );
  }

  // Convert to percentage
  const percentData = data.map(d => ({
    ...d,
    trainAccuracy: d.trainAccuracy ? d.trainAccuracy * 100 : null,
    validAccuracy: d.validAccuracy ? d.validAccuracy * 100 : null
  }));

  return (
    <div className="chart-tab">
      <h3>{t('fineTuning.metrics.accuracyHistory', 'Accuracy History')}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={percentData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="step"
            label={{ value: 'Step', position: 'bottom', offset: -5 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(value) => `${value?.toFixed(2)}%`}
            labelFormatter={(label) => `Step ${label}`}
          />
          <Legend verticalAlign="top" height={36} />
          <Line
            type="monotone"
            dataKey="trainAccuracy"
            name={t('fineTuning.metrics.trainAccuracy', 'Training Accuracy')}
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="validAccuracy"
            name={t('fineTuning.metrics.validAccuracy', 'Validation Accuracy')}
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Model Comparison Tab
function ComparisonTab({ data, t }) {
  if (!data || data.length < 2) {
    return (
      <div className="no-data">
        <p>{t('fineTuning.metrics.noCompareData', 'Select multiple models to compare.')}</p>
      </div>
    );
  }

  return (
    <div className="chart-tab comparison-tab">
      <h3>{t('fineTuning.metrics.modelComparison', 'Model Comparison')}</h3>

      {/* Loss Comparison */}
      <div className="comparison-chart">
        <h4>{t('fineTuning.metrics.lossComparison', 'Loss Comparison')}</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="finalLoss"
              name={t('fineTuning.metrics.finalLoss', 'Final Loss')}
              fill="#3b82f6"
            />
            <Bar
              dataKey="bestLoss"
              name={t('fineTuning.metrics.bestLoss', 'Best Loss')}
              fill="#22c55e"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Accuracy Comparison */}
      <div className="comparison-chart">
        <h4>{t('fineTuning.metrics.accuracyComparison', 'Accuracy Comparison')}</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={data.map(d => ({
              ...d,
              finalAccuracy: d.finalAccuracy ? d.finalAccuracy * 100 : 0,
              bestAccuracy: d.bestAccuracy ? d.bestAccuracy * 100 : 0
            }))}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
            <Legend />
            <Bar
              dataKey="finalAccuracy"
              name={t('fineTuning.metrics.finalAccuracy', 'Final Accuracy (%)')}
              fill="#f59e0b"
            />
            <Bar
              dataKey="bestAccuracy"
              name={t('fineTuning.metrics.bestAccuracy', 'Best Accuracy (%)')}
              fill="#8b5cf6"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Comparison Table */}
      <div className="comparison-table">
        <h4 id="comparison-table-heading">{t('fineTuning.metrics.detailedComparison', 'Detailed Comparison')}</h4>
        <table role="table" aria-labelledby="comparison-table-heading">
          <thead>
            <tr>
              <th scope="col">{t('fineTuning.modelName', 'Model')}</th>
              <th scope="col">{t('fineTuning.baseModel', 'Base Model')}</th>
              <th scope="col">{t('fineTuning.status.label', 'Status')}</th>
              <th scope="col">{t('fineTuning.metrics.finalLoss', 'Final Loss')}</th>
              <th scope="col">{t('fineTuning.metrics.finalAccuracy', 'Accuracy')}</th>
              <th scope="col">{t('fineTuning.metrics.totalTokens', 'Tokens')}</th>
              <th scope="col">{t('fineTuning.metrics.trainingCost', 'Cost')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((model) => (
              <tr key={model.id}>
                <td>{model.name}</td>
                <td>{model.baseModel}</td>
                <td>
                  <span className={`status-badge ${model.status}`}>
                    {model.status}
                  </span>
                </td>
                <td>{model.finalLoss?.toFixed(4) || 'N/A'}</td>
                <td>
                  {model.finalAccuracy
                    ? `${(model.finalAccuracy * 100).toFixed(1)}%`
                    : 'N/A'}
                </td>
                <td>{model.totalTokens?.toLocaleString() || '0'}</td>
                <td>{model.trainingCost ? `$${model.trainingCost.toFixed(2)}` : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

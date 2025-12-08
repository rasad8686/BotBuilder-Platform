import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExecutionMonitor } from '../components/execution';

const ExecutionHistory = () => {
  const { t } = useTranslation();
  const { botId: urlBotId, executionId } = useParams();
  const navigate = useNavigate();

  const [bots, setBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState(urlBotId || '');
  const [executions, setExecutions] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [showMonitor, setShowMonitor] = useState(false);

  const token = localStorage.getItem('token');
  const botId = selectedBotId || urlBotId;

  // Fetch bots list on mount
  useEffect(() => {
    const fetchBots = async () => {
      try {
        const res = await fetch('/api/bots', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const botsArray = Array.isArray(data) ? data : (data.bots || []);
          setBots(botsArray);
          // If no bot selected and we have bots, select the first one
          if (!selectedBotId && !urlBotId && botsArray.length > 0) {
            setSelectedBotId(botsArray[0].id.toString());
          }
        }
      } catch (err) {
        // Silent fail
      }
    };
    fetchBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  useEffect(() => {
    if (executionId) {
      fetchExecutionDetail(executionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // If no botId, skip fetching
      if (!botId) {
        setIsLoading(false);
        return;
      }

      // Fetch workflows for this bot
      const workflowRes = await fetch(`/api/workflows?bot_id=${botId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (workflowRes.ok) {
        const data = await workflowRes.json();
        setWorkflows(data);
      }

      // Fetch executions
      await fetchExecutions();
    } catch (err) {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExecutions = async () => {
    // If no botId, skip fetching
    if (!botId) return;

    try {
      let url = `/api/executions?bot_id=${botId}`;
      if (selectedWorkflow !== 'all') {
        url += `&workflow_id=${selectedWorkflow}`;
      }
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      if (dateRange.start) {
        url += `&start_date=${dateRange.start}`;
      }
      if (dateRange.end) {
        url += `&end_date=${dateRange.end}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setExecutions(data);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const fetchExecutionDetail = async (id) => {
    try {
      const res = await fetch(`/api/executions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedExecution(data);
        setShowMonitor(true);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('executionHistory.deleteConfirm'))) return;

    try {
      const res = await fetch(`/api/executions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setExecutions((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      // Silent fail
    }
  };

  const handleViewExecution = (execution) => {
    navigate(`/bots/${botId}/executions/${execution.id}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // PostgreSQL returns UTC time - parse and add 4 hours for UTC+4
    let date = new Date(dateString);
    // Add 4 hours offset for Tbilisi timezone (UTC+4)
    date = new Date(date.getTime() + (4 * 60 * 60 * 1000));
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (ms) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: { bg: '#dcfce7', color: '#166534' },
      failed: { bg: '#fee2e2', color: '#dc2626' },
      running: { bg: '#dbeafe', color: '#1d4ed8' },
      pending: { bg: '#f3f4f6', color: '#6b7280' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span
        className="status-badge"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        {status}
      </span>
    );
  };

  useEffect(() => {
    if (selectedWorkflow !== 'all' || statusFilter !== 'all' || dateRange.start || dateRange.end) {
      fetchExecutions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkflow, statusFilter, dateRange]);

  const handleBotChange = (e) => {
    const newBotId = e.target.value;
    setSelectedBotId(newBotId);
    setExecutions([]);
    setWorkflows([]);
    setSelectedWorkflow('all');
  };

  if (showMonitor && selectedExecution) {
    return (
      <div className="execution-history" style={{ height: '100vh' }}>
        <ExecutionMonitor
          workflowId={selectedExecution.workflow_id}
          onClose={() => {
            setShowMonitor(false);
            setSelectedExecution(null);
            navigate(`/bots/${botId}/executions`);
          }}
        />
      </div>
    );
  }

  return (
    <div className="execution-history">
      <div className="page-header">
        <div className="header-left">
          {botId && (
            <Link to={`/bots/${botId}/workflows`} className="back-link">
              ← {t('executionHistory.backToWorkflows')}
            </Link>
          )}
          <h1>{t('executionHistory.title')}</h1>
        </div>
        <div className="header-right">
          <div className="bot-selector">
            <label>{t('executionHistory.selectBot')}</label>
            <select value={selectedBotId} onChange={handleBotChange}>
              <option value="">-- {t('executionHistory.selectBot')} --</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>{bot.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!botId ? (
        <div className="no-bot-selected">
          <span className="empty-icon">📋</span>
          <h3>{t('executionHistory.selectBot')}</h3>
          <p>{t('executionHistory.selectBotDesc')}</p>
        </div>
      ) : (
        <>
          <div className="filters-section">
            <div className="filter-group">
              <label>{t('executionHistory.workflow')}</label>
              <select
                value={selectedWorkflow}
                onChange={(e) => setSelectedWorkflow(e.target.value)}
              >
                <option value="all">{t('executionHistory.allWorkflows')}</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>{t('executionHistory.status')}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">{t('executionHistory.allStatuses')}</option>
                <option value="completed">{t('common.completed')}</option>
                <option value="failed">{t('common.failed')}</option>
                <option value="running">{t('common.running')}</option>
                <option value="pending">{t('common.pending')}</option>
              </select>
            </div>

            <div className="filter-group">
              <label>{t('executionHistory.fromDate')}</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>

            <div className="filter-group">
              <label>{t('executionHistory.toDate')}</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
          </div>

          <div className="executions-table-wrapper">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>{t('executionHistory.loading')}</p>
          </div>
        ) : executions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <h3>{t('executionHistory.noExecutions')}</h3>
            <p>{t('executionHistory.noExecutionsDesc')}</p>
          </div>
        ) : (
          <table className="executions-table">
            <thead>
              <tr>
                <th>{t('executionHistory.date')}</th>
                <th>{t('executionHistory.workflow')}</th>
                <th>{t('executionHistory.status')}</th>
                <th>{t('executionHistory.duration')}</th>
                <th>{t('executionHistory.tokens')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.id}>
                  <td>{formatDate(execution.created_at)}</td>
                  <td>{execution.workflow_name || execution.input?.orchestration_name || (execution.workflow_id ? `Workflow #${execution.workflow_id}` : `Orchestration #${execution.input?.orchestration_id || '?'}`)}</td>
                  <td>{getStatusBadge(execution.status)}</td>
                  <td>{formatDuration(execution.duration)}</td>
                  <td>{execution.total_tokens?.toLocaleString() || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-view"
                        onClick={() => handleViewExecution(execution)}
                      >
                        👁️ {t('common.view')}
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(execution.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
          </div>
        </>
      )}

      <style>{`
        .execution-history {
          min-height: 100vh;
          background: #f8fafc;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .header-right {
          display: flex;
          align-items: center;
        }

        .bot-selector {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .bot-selector label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .bot-selector select {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          min-width: 200px;
          background: white;
          cursor: pointer;
        }

        .bot-selector select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .no-bot-selected {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px;
          margin: 24px 32px;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .no-bot-selected h3 {
          margin: 0 0 8px 0;
          color: #1e293b;
        }

        .no-bot-selected p {
          margin: 0;
          color: #64748b;
        }

        .back-link {
          color: #667eea;
          text-decoration: none;
          font-size: 14px;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        h1 {
          margin: 0;
          font-size: 24px;
          color: #1e293b;
        }

        .filters-section {
          display: flex;
          gap: 16px;
          padding: 20px 32px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-group label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .filter-group select,
        .filter-group input {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
          min-width: 150px;
        }

        .filter-group select:focus,
        .filter-group input:focus {
          outline: none;
          border-color: #667eea;
        }

        .executions-table-wrapper {
          padding: 24px 32px;
        }

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          color: #1e293b;
        }

        .empty-state p {
          margin: 0;
          color: #64748b;
        }

        .executions-table {
          width: 100%;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          border-collapse: collapse;
          overflow: hidden;
        }

        .executions-table th,
        .executions-table td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        .executions-table th {
          background: #f8fafc;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .executions-table tr:last-child td {
          border-bottom: none;
        }

        .executions-table tr:hover {
          background: #f8fafc;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .btn-view,
        .btn-delete {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-view {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .btn-view:hover {
          background: #dbeafe;
        }

        .btn-delete {
          background: #fee2e2;
          color: #dc2626;
        }

        .btn-delete:hover {
          background: #fecaca;
        }
      `}</style>
    </div>
  );
};

export default ExecutionHistory;

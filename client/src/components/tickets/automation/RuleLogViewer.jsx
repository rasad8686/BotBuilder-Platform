/**
 * Rule Log Viewer Component
 * View automation rule execution logs
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Filter,
  Download,
  Search,
} from 'lucide-react';

const RuleLogViewer = ({ ruleId, ruleName, onClose }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedLog, setExpandedLog] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [ruleId, page, filter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (filter !== 'all') {
        params.append('status', filter);
      }

      const response = await fetch(`/api/ticket-automation/rules/${ruleId}/logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setTotalPages(Math.ceil((data.total || 0) / 20));
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const response = await fetch(`/api/ticket-automation/rules/${ruleId}/logs/export`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rule-logs-${ruleId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting logs:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const ticketId = log.ticket_id?.toString() || '';
    return ticketId.includes(searchTerm);
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('tickets.automation.executionLogs', 'Execution Logs')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {ruleName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('tickets.automation.searchTicketId', 'Search by ticket ID...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">{t('common.all', 'All')}</option>
              <option value="success">{t('common.success', 'Success')}</option>
              <option value="failed">{t('common.failed', 'Failed')}</option>
              <option value="partial">{t('common.partial', 'Partial')}</option>
            </select>

            <button
              onClick={fetchLogs}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('common.refresh', 'Refresh')}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportLogs}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('common.export', 'Export')}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {t('tickets.automation.noLogs', 'No execution logs found')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <LogEntry
                  key={log.id}
                  log={log}
                  isExpanded={expandedLog === log.id}
                  onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  getStatusIcon={getStatusIcon}
                  getStatusColor={getStatusColor}
                  formatDuration={formatDuration}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('common.page', 'Page')} {page} {t('common.of', 'of')} {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.previous', 'Previous')}
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.next', 'Next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Log Entry Component
 */
const LogEntry = ({ log, isExpanded, onToggle, getStatusIcon, getStatusColor, formatDuration, t }) => {
  const executedAt = new Date(log.executed_at);
  const formattedDate = executedAt.toLocaleString();

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Log Header */}
      <div
        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <button className="p-0.5">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {getStatusIcon(log.status)}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">
                {t('tickets.automation.ticket', 'Ticket')} #{log.ticket_id}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(log.status)}`}>
                {log.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formattedDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>{log.actions_executed || 0} {t('tickets.automation.actionsExecuted', 'actions')}</span>
          <span>{formatDuration(log.execution_time_ms || 0)}</span>
          {log.ticket_id && (
            <a
              href={`/tickets/${log.ticket_id}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title={t('tickets.automation.viewTicket', 'View ticket')}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Log Details */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* Conditions Matched */}
          {log.conditions_matched && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tickets.automation.conditionsMatched', 'Conditions Matched')}
              </h4>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {JSON.stringify(log.conditions_matched, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Actions Executed */}
          {log.actions_result && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tickets.automation.actionsResult', 'Actions Result')}
              </h4>
              <div className="space-y-2">
                {(Array.isArray(log.actions_result) ? log.actions_result : [log.actions_result]).map((action, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      action.success
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {action.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm font-medium ${
                        action.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                      }`}>
                        {action.type || action.action}
                      </span>
                    </div>
                    {action.error && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {action.error}
                      </p>
                    )}
                    {action.details && (
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {typeof action.details === 'string' ? action.details : JSON.stringify(action.details)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {log.error_message && (
            <div>
              <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                {t('tickets.automation.error', 'Error')}
              </h4>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-300">
                  {log.error_message}
                </p>
              </div>
            </div>
          )}

          {/* Execution Context */}
          {log.context && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('tickets.automation.context', 'Execution Context')}
              </h4>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(log.context, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RuleLogViewer;

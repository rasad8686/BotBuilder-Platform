import React, { useState, Fragment } from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';

/**
 * AuditLogTable Component
 * Displays audit logs in a table with expandable details
 */
const AuditLogTable = ({ logs, loading = false }) => {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Get badge color for action
  const getActionBadgeColor = (action) => {
    if (action.includes('failed') || action.includes('deleted')) {
      return 'bg-red-100 text-red-800';
    }
    if (action.includes('created') || action.includes('register') || action.includes('login.success')) {
      return 'bg-green-100 text-green-800';
    }
    if (action.includes('updated') || action.includes('changed')) {
      return 'bg-orange-100 text-orange-800';
    }
    if (action.includes('security') || action.includes('unauthorized')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address'];
    const rows = logs.map(log => [
      formatTimestamp(log.created_at),
      log.user_name || 'System',
      log.action,
      log.resource_type,
      log.resource_id || '',
      log.ip_address || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString()}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-28"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">No audit logs found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Export button */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex justify-end">
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-400"
          aria-label="Export audit logs to CSV file"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Audit logs">
          <caption className="sr-only">Audit log entries showing user actions, timestamps, and resources</caption>
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="w-8 px-3 py-3"><span className="sr-only">Expand row</span></th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => {
              const isExpanded = expandedRows.has(log.id);
              const hasDetails = log.old_values || log.new_values || log.metadata;

              return (
                <Fragment key={log.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => hasDetails && toggleRow(log.id)}
                  >
                    <td className="px-3 py-4 text-center">
                      {hasDetails && (
                        <button
                          className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {log.user_name || 'System'}
                      </div>
                      {log.user_email && (
                        <div className="text-sm text-gray-500">{log.user_email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{log.resource_type}</div>
                      {log.resource_id && (
                        <div className="text-xs text-gray-400">ID: {log.resource_id}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ip_address || '-'}
                    </td>
                  </tr>

                  {/* Expanded details row */}
                  {isExpanded && hasDetails && (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 bg-gray-50">
                        <div className="space-y-4">
                          {/* User Agent */}
                          {log.user_agent && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">User Agent</h4>
                              <p className="text-sm text-gray-600 font-mono text-xs">
                                {log.user_agent}
                              </p>
                            </div>
                          )}

                          {/* Old Values */}
                          {log.old_values && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Old Values</h4>
                              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                                {JSON.stringify(log.old_values, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* New Values */}
                          {log.new_values && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">New Values</h4>
                              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Metadata */}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Metadata</h4>
                              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogTable;

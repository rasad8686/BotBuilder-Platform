import React, { useState, useMemo } from 'react';

const ErrorLog = ({
  errors = [],
  warnings = [],
  logs = [],
  onNodeSelect = () => {}
}) => {
  const [filter, setFilter] = useState('all'); // 'all' | 'errors' | 'warnings' | 'logs'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  // Combine and sort all log entries
  const allEntries = useMemo(() => {
    const entries = [
      ...errors.map(e => ({ ...e, type: 'error' })),
      ...warnings.map(w => ({ ...w, type: 'warning' })),
      ...logs.map(l => ({ ...l, type: 'log' }))
    ];

    // Sort by timestamp (newest first)
    entries.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    return entries;
  }, [errors, warnings, logs]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    let entries = allEntries;

    // Filter by type
    if (filter !== 'all') {
      entries = entries.filter(e => {
        if (filter === 'errors') return e.type === 'error';
        if (filter === 'warnings') return e.type === 'warning';
        if (filter === 'logs') return e.type === 'log';
        return true;
      });
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      entries = entries.filter(e =>
        e.message?.toLowerCase().includes(query) ||
        e.nodeId?.toLowerCase().includes(query) ||
        e.stack?.toLowerCase().includes(query)
      );
    }

    return entries;
  }, [allEntries, filter, searchQuery]);

  const toggleExpand = (index) => {
    setExpandedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'error':
        return {
          icon: '✗',
          color: '#ef4444',
          bgColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.3)'
        };
      case 'warning':
        return {
          icon: '⚠',
          color: '#f59e0b',
          bgColor: 'rgba(245, 158, 11, 0.1)',
          borderColor: 'rgba(245, 158, 11, 0.3)'
        };
      case 'log':
        return {
          icon: 'ℹ',
          color: '#3b82f6',
          bgColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.3)'
        };
      default:
        return {
          icon: '○',
          color: '#6c757d',
          bgColor: 'rgba(108, 117, 125, 0.1)',
          borderColor: 'rgba(108, 117, 125, 0.3)'
        };
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const copyToClipboard = (entry) => {
    const text = `[${entry.type.toUpperCase()}] ${entry.message}${entry.stack ? '\n\nStack:\n' + entry.stack : ''}`;
    navigator.clipboard.writeText(text);
  };

  const filterOptions = [
    { id: 'all', label: 'All', count: allEntries.length },
    { id: 'errors', label: 'Errors', count: errors.length, color: '#ef4444' },
    { id: 'warnings', label: 'Warnings', count: warnings.length, color: '#f59e0b' },
    { id: 'logs', label: 'Logs', count: logs.length, color: '#3b82f6' }
  ];

  const isEmpty = filteredEntries.length === 0;

  return (
    <div style={styles.container}>
      {/* Filter Tabs */}
      <div style={styles.filterTabs}>
        {filterOptions.map(option => (
          <button
            key={option.id}
            onClick={() => setFilter(option.id)}
            style={{
              ...styles.filterTab,
              ...(filter === option.id ? styles.activeFilterTab : {}),
              ...(filter === option.id && option.color ? { borderBottomColor: option.color } : {})
            }}
          >
            <span>{option.label}</span>
            {option.count > 0 && (
              <span style={{
                ...styles.filterCount,
                backgroundColor: option.color || '#6c757d'
              }}>
                {option.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={styles.searchWrapper}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          placeholder="Search logs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            ✕
          </button>
        )}
      </div>

      {/* Log Entries */}
      {isEmpty ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            {filter === 'errors' ? '✓' : filter === 'warnings' ? '👍' : '📝'}
          </div>
          <p style={styles.emptyText}>
            {searchQuery
              ? 'No matching entries'
              : filter === 'errors'
                ? 'No errors'
                : filter === 'warnings'
                  ? 'No warnings'
                  : 'No log entries yet'}
          </p>
          <p style={styles.emptySubtext}>
            {filter === 'errors'
              ? 'Great! Your workflow is running smoothly'
              : filter === 'warnings'
                ? 'No warnings to display'
                : 'Logs will appear here during execution'}
          </p>
        </div>
      ) : (
        <div style={styles.logList}>
          {filteredEntries.map((entry, index) => {
            const typeStyles = getTypeStyles(entry.type);
            const isExpanded = expandedItems[index];
            const hasDetails = entry.stack || entry.details;

            return (
              <div
                key={index}
                style={{
                  ...styles.logEntry,
                  backgroundColor: typeStyles.bgColor,
                  borderColor: typeStyles.borderColor
                }}
              >
                {/* Entry Header */}
                <div style={styles.entryHeader}>
                  <div style={{
                    ...styles.typeIcon,
                    backgroundColor: typeStyles.color
                  }}>
                    {typeStyles.icon}
                  </div>

                  <div style={styles.entryContent}>
                    <div style={styles.entryMessage}>
                      {entry.message}
                    </div>

                    <div style={styles.entryMeta}>
                      {entry.nodeId && (
                        <button
                          onClick={() => onNodeSelect(entry.nodeId)}
                          style={styles.nodeLink}
                        >
                          📍 {entry.nodeId}
                        </button>
                      )}
                      {entry.timestamp && (
                        <span style={styles.timestamp}>
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={styles.entryActions}>
                    <button
                      onClick={() => copyToClipboard(entry)}
                      style={styles.actionButton}
                      title="Copy to clipboard"
                    >
                      📋
                    </button>
                    {hasDetails && (
                      <button
                        onClick={() => toggleExpand(index)}
                        style={styles.actionButton}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && hasDetails && (
                  <div style={styles.entryDetails}>
                    {entry.stack && (
                      <div style={styles.stackTrace}>
                        <div style={styles.stackHeader}>Stack Trace:</div>
                        <pre style={styles.stackContent}>
                          {entry.stack}
                        </pre>
                      </div>
                    )}
                    {entry.details && (
                      <div style={styles.additionalDetails}>
                        <div style={styles.detailsHeader}>Details:</div>
                        <pre style={styles.detailsContent}>
                          {typeof entry.details === 'object'
                            ? JSON.stringify(entry.details, null, 2)
                            : entry.details}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Footer */}
      {allEntries.length > 0 && (
        <div style={styles.footer}>
          <span>{errors.length} errors</span>
          <span>•</span>
          <span>{warnings.length} warnings</span>
          <span>•</span>
          <span>{logs.length} logs</span>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  filterTabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '12px'
  },
  filterTab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px',
    backgroundColor: '#2d2d44',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    borderRadius: '6px 6px 0 0',
    color: '#6c757d',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  activeFilterTab: {
    backgroundColor: '#3d3d5c',
    color: '#e4e4e7'
  },
  filterCount: {
    padding: '2px 6px',
    borderRadius: '8px',
    fontSize: '10px',
    fontWeight: '600',
    color: 'white'
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    fontSize: '12px',
    pointerEvents: 'none'
  },
  searchInput: {
    width: '100%',
    padding: '8px 32px 8px 36px',
    backgroundColor: '#2d2d44',
    border: '1px solid #3d3d5c',
    borderRadius: '6px',
    color: '#e4e4e7',
    fontSize: '12px',
    outline: 'none'
  },
  clearButton: {
    position: 'absolute',
    right: '8px',
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#6c757d',
    cursor: 'pointer',
    fontSize: '10px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 16px',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5
  },
  emptyText: {
    color: '#e4e4e7',
    fontSize: '14px',
    fontWeight: '500',
    margin: '0 0 8px 0'
  },
  emptySubtext: {
    color: '#6c757d',
    fontSize: '12px',
    margin: 0
  },
  logList: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflow: 'auto'
  },
  logEntry: {
    borderRadius: '8px',
    border: '1px solid',
    overflow: 'hidden'
  },
  entryHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px'
  },
  typeIcon: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    flexShrink: 0
  },
  entryContent: {
    flex: 1,
    minWidth: 0
  },
  entryMessage: {
    fontSize: '12px',
    color: '#e4e4e7',
    lineHeight: 1.5,
    wordBreak: 'break-word'
  },
  entryMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '6px'
  },
  nodeLink: {
    padding: '2px 8px',
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    border: 'none',
    borderRadius: '4px',
    color: '#667eea',
    fontSize: '10px',
    cursor: 'pointer'
  },
  timestamp: {
    fontSize: '10px',
    color: '#6c757d'
  },
  entryActions: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0
  },
  actionButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: '#6c757d',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  entryDetails: {
    padding: '0 12px 12px 48px'
  },
  stackTrace: {
    marginBottom: '8px'
  },
  stackHeader: {
    fontSize: '10px',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px'
  },
  stackContent: {
    margin: 0,
    padding: '12px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    fontSize: '10px',
    fontFamily: "'Fira Code', 'Monaco', monospace",
    color: '#ef4444',
    overflow: 'auto',
    maxHeight: '150px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  additionalDetails: {
    marginTop: '8px'
  },
  detailsHeader: {
    fontSize: '10px',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px'
  },
  detailsContent: {
    margin: 0,
    padding: '12px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    fontSize: '10px',
    fontFamily: "'Fira Code', 'Monaco', monospace",
    color: '#a5d6ff',
    overflow: 'auto',
    maxHeight: '150px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '16px',
    padding: '8px',
    backgroundColor: '#2d2d44',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#6c757d'
  }
};

export default ErrorLog;

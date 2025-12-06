import React, { useState, useMemo } from 'react';

const VariablesViewer = ({
  variables = {},
  nodeOutputs = {}
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVars, setExpandedVars] = useState({});
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'json'

  // Combine all variables
  const allVariables = useMemo(() => {
    const combined = { ...variables };

    // Add outputs from nodes
    Object.entries(nodeOutputs).forEach(([nodeId, data]) => {
      if (data?.output) {
        combined[`$node.${nodeId}.output`] = data.output;
      }
      if (data?.input) {
        combined[`$node.${nodeId}.input`] = data.input;
      }
    });

    return combined;
  }, [variables, nodeOutputs]);

  // Filter variables
  const filteredVariables = useMemo(() => {
    if (!searchQuery) return allVariables;

    const query = searchQuery.toLowerCase();
    const filtered = {};

    Object.entries(allVariables).forEach(([key, value]) => {
      if (
        key.toLowerCase().includes(query) ||
        JSON.stringify(value).toLowerCase().includes(query)
      ) {
        filtered[key] = value;
      }
    });

    return filtered;
  }, [allVariables, searchQuery]);

  const toggleExpand = (key) => {
    setExpandedVars(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getTypeColor = (value) => {
    if (value === null) return '#f59e0b';
    if (value === undefined) return '#6c757d';
    switch (typeof value) {
      case 'string': return '#22c55e';
      case 'number': return '#3b82f6';
      case 'boolean': return '#a855f7';
      case 'object': return '#ec4899';
      default: return '#e4e4e7';
    }
  };

  const getTypeLabel = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return `array[${value.length}]`;
    if (typeof value === 'object') return `object{${Object.keys(value).length}}`;
    return typeof value;
  };

  const formatValue = (value, expanded = false) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
      if (!expanded) return `[${value.length} items]`;
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'object') {
      if (!expanded) return `{${Object.keys(value).length} keys}`;
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const copyToClipboard = (value) => {
    const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    navigator.clipboard.writeText(text);
  };

  const variableEntries = Object.entries(filteredVariables);
  const isEmpty = variableEntries.length === 0;

  return (
    <div style={styles.container}>
      {/* Search & Controls */}
      <div style={styles.controls}>
        <div style={styles.searchWrapper}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search variables..."
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

        <div style={styles.viewToggle}>
          <button
            onClick={() => setViewMode('tree')}
            style={{
              ...styles.viewButton,
              ...(viewMode === 'tree' ? styles.activeViewButton : {})
            }}
          >
            Tree
          </button>
          <button
            onClick={() => setViewMode('json')}
            style={{
              ...styles.viewButton,
              ...(viewMode === 'json' ? styles.activeViewButton : {})
            }}
          >
            JSON
          </button>
        </div>
      </div>

      {/* Variables List */}
      {isEmpty ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📦</div>
          <p style={styles.emptyText}>
            {searchQuery ? 'No matching variables' : 'No variables yet'}
          </p>
          <p style={styles.emptySubtext}>
            Variables will appear here as the workflow executes
          </p>
        </div>
      ) : viewMode === 'json' ? (
        <pre style={styles.jsonView}>
          {JSON.stringify(filteredVariables, null, 2)}
        </pre>
      ) : (
        <div style={styles.variablesList}>
          {variableEntries.map(([key, value]) => {
            const isExpandable = typeof value === 'object' && value !== null;
            const isExpanded = expandedVars[key];

            return (
              <div key={key} style={styles.variableItem}>
                <div style={styles.variableHeader}>
                  {isExpandable && (
                    <button
                      onClick={() => toggleExpand(key)}
                      style={styles.expandButton}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  )}

                  <span style={styles.variableName}>{key}</span>

                  <span style={{
                    ...styles.typeLabel,
                    color: getTypeColor(value)
                  }}>
                    {getTypeLabel(value)}
                  </span>

                  <button
                    onClick={() => copyToClipboard(value)}
                    style={styles.copyButton}
                    title="Copy value"
                  >
                    📋
                  </button>
                </div>

                <div style={styles.variableValue}>
                  {isExpandable ? (
                    isExpanded ? (
                      <pre style={styles.expandedValue}>
                        {formatValue(value, true)}
                      </pre>
                    ) : (
                      <span style={{ color: getTypeColor(value) }}>
                        {formatValue(value, false)}
                      </span>
                    )
                  ) : (
                    <span style={{ color: getTypeColor(value) }}>
                      {formatValue(value)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div style={styles.stats}>
        <span>Total: {Object.keys(allVariables).length} variables</span>
        {searchQuery && (
          <span>Showing: {variableEntries.length}</span>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  controls: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px'
  },
  searchWrapper: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
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
  viewToggle: {
    display: 'flex',
    backgroundColor: '#2d2d44',
    borderRadius: '6px',
    padding: '2px'
  },
  viewButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: '#6c757d',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  activeViewButton: {
    backgroundColor: '#667eea',
    color: 'white'
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
  jsonView: {
    flex: 1,
    margin: 0,
    padding: '16px',
    backgroundColor: '#2d2d44',
    borderRadius: '8px',
    fontSize: '11px',
    fontFamily: "'Fira Code', 'Monaco', monospace",
    color: '#a5d6ff',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  variablesList: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflow: 'auto'
  },
  variableItem: {
    backgroundColor: '#2d2d44',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #3d3d5c'
  },
  variableHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  expandButton: {
    padding: '2px 4px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#6c757d',
    fontSize: '8px',
    cursor: 'pointer'
  },
  variableName: {
    flex: 1,
    fontFamily: "'Fira Code', 'Monaco', monospace",
    fontSize: '12px',
    color: '#e4e4e7',
    fontWeight: '500'
  },
  typeLabel: {
    fontSize: '10px',
    fontFamily: 'monospace',
    padding: '2px 6px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '4px'
  },
  copyButton: {
    padding: '4px 6px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '12px',
    cursor: 'pointer',
    opacity: 0.5,
    transition: 'opacity 0.2s'
  },
  variableValue: {
    fontFamily: "'Fira Code', 'Monaco', monospace",
    fontSize: '11px',
    padding: '8px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  expandedValue: {
    margin: 0,
    color: '#a5d6ff',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '16px',
    padding: '8px 12px',
    backgroundColor: '#2d2d44',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#6c757d'
  }
};

export default VariablesViewer;

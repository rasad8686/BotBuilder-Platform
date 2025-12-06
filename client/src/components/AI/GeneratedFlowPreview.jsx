import React, { useState } from 'react';

const NODE_TYPE_ICONS = {
  start: '▶️',
  message: '💬',
  question: '❓',
  input: '📝',
  menu: '📋',
  condition: '🔀',
  action: '⚡',
  api_call: '🔌',
  set_variable: '📊',
  delay: '⏱️',
  email: '📧',
  webhook: '🔗',
  ai_response: '🤖',
  goto: '↩️',
  end: '🏁'
};

const NODE_TYPE_COLORS = {
  start: '#10b981',
  message: '#3b82f6',
  question: '#8b5cf6',
  input: '#f59e0b',
  menu: '#ec4899',
  condition: '#6366f1',
  action: '#ef4444',
  api_call: '#14b8a6',
  set_variable: '#f97316',
  delay: '#6b7280',
  email: '#0ea5e9',
  webhook: '#84cc16',
  ai_response: '#a855f7',
  goto: '#64748b',
  end: '#dc2626'
};

export default function GeneratedFlowPreview({ flow, onUseFlow, onBack, onEdit }) {
  const [editingNode, setEditingNode] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'visual'

  const handleEditNode = (node) => {
    setEditingNode(node.id);
    setEditContent(node.data?.content || '');
  };

  const handleSaveEdit = (nodeId) => {
    if (!onEdit) return;

    const updatedFlow = {
      ...flow,
      nodes: flow.nodes.map(node =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, content: editContent } }
          : node
      )
    };

    onEdit(updatedFlow);
    setEditingNode(null);
    setEditContent('');
  };

  const handleDeleteNode = (nodeId) => {
    if (!onEdit) return;

    const updatedFlow = {
      ...flow,
      nodes: flow.nodes.filter(node => node.id !== nodeId),
      edges: flow.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId)
    };

    onEdit(updatedFlow);
  };

  const getConnectedNodes = (nodeId) => {
    const outgoing = flow.edges?.filter(e => e.source === nodeId).map(e => e.target) || [];
    return outgoing;
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '32px',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px'
      }}>
        <div>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '14px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0
              }}
            >
              ← Back to generator
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
            {flow.name || 'Generated Flow'}
          </h2>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '14px' }}>
            {flow.description || 'Review and customize before using'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'visual' : 'list')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {viewMode === 'list' ? '📊 Visual' : '📋 List'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          padding: '16px',
          backgroundColor: '#eff6ff',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1d4ed8' }}>
            {flow.nodes?.length || 0}
          </div>
          <div style={{ fontSize: '13px', color: '#3b82f6' }}>Nodes</div>
        </div>
        <div style={{
          padding: '16px',
          backgroundColor: '#f0fdf4',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#15803d' }}>
            {flow.edges?.length || 0}
          </div>
          <div style={{ fontSize: '13px', color: '#16a34a' }}>Connections</div>
        </div>
        <div style={{
          padding: '16px',
          backgroundColor: '#fef3c7',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#92400e' }}>
            {flow.variables?.length || 0}
          </div>
          <div style={{ fontSize: '13px', color: '#b45309' }}>Variables</div>
        </div>
        <div style={{
          padding: '16px',
          backgroundColor: '#fae8ff',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#86198f' }}>
            {[...new Set(flow.nodes?.map(n => n.type) || [])].length}
          </div>
          <div style={{ fontSize: '13px', color: '#a21caf' }}>Node Types</div>
        </div>
      </div>

      {/* Node List View */}
      {viewMode === 'list' && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Flow Nodes
          </h3>
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            {flow.nodes?.map((node, index) => {
              const connectedTo = getConnectedNodes(node.id);
              const isEditing = editingNode === node.id;

              return (
                <div
                  key={node.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: index < flow.nodes.length - 1 ? '1px solid #e5e7eb' : 'none',
                    backgroundColor: isEditing ? '#f9fafb' : 'white'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    {/* Node Icon */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: `${NODE_TYPE_COLORS[node.type] || '#6b7280'}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0
                    }}>
                      {NODE_TYPE_ICONS[node.type] || '📦'}
                    </div>

                    {/* Node Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <span style={{ fontWeight: '600', fontSize: '15px' }}>
                          {node.data?.label || node.id}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: `${NODE_TYPE_COLORS[node.type] || '#6b7280'}20`,
                          color: NODE_TYPE_COLORS[node.type] || '#6b7280',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          {node.type}
                        </span>
                      </div>

                      {isEditing ? (
                        <div style={{ marginTop: '8px' }}>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              padding: '10px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '14px',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                              fontFamily: 'inherit'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                              onClick={() => handleSaveEdit(node.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingNode(null)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#f3f4f6',
                                color: '#374151',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {node.data?.content && (
                            <p style={{
                              margin: 0,
                              fontSize: '14px',
                              color: '#4b5563',
                              lineHeight: '1.5',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {node.data.content.length > 150
                                ? node.data.content.substring(0, 150) + '...'
                                : node.data.content}
                            </p>
                          )}

                          {/* Options for menu/question nodes */}
                          {(node.data?.options || node.data?.choices) && (
                            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {(node.data.options || node.data.choices).slice(0, 4).map((opt, i) => (
                                <span
                                  key={i}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    color: '#4b5563'
                                  }}
                                >
                                  {typeof opt === 'string' ? opt : opt.label}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Connected to */}
                          {connectedTo.length > 0 && (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                              → Connects to: {connectedTo.join(', ')}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {!isEditing && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleEditNode(node)}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#f3f4f6',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Edit
                        </button>
                        {node.type !== 'start' && (
                          <button
                            onClick={() => handleDeleteNode(node.id)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual View - Simple representation */}
      {viewMode === 'visual' && (
        <div style={{
          marginBottom: '24px',
          padding: '24px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          minHeight: '300px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            {flow.nodes?.map((node, index) => {
              const connectedTo = getConnectedNodes(node.id);

              return (
                <React.Fragment key={node.id}>
                  <div style={{
                    padding: '12px 20px',
                    backgroundColor: 'white',
                    border: `2px solid ${NODE_TYPE_COLORS[node.type] || '#6b7280'}`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    minWidth: '200px',
                    justifyContent: 'center'
                  }}>
                    <span>{NODE_TYPE_ICONS[node.type] || '📦'}</span>
                    <span style={{ fontWeight: '500' }}>{node.data?.label || node.type}</span>
                  </div>

                  {index < flow.nodes.length - 1 && connectedTo.length > 0 && (
                    <div style={{
                      width: '2px',
                      height: '20px',
                      backgroundColor: '#d1d5db'
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <p style={{
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '13px',
            marginTop: '20px'
          }}>
            Simplified visual. Full visual editor available after importing.
          </p>
        </div>
      )}

      {/* Variables */}
      {flow.variables?.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Variables ({flow.variables.length})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {flow.variables.map((variable, index) => (
              <div
                key={index}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
              >
                <span style={{ color: '#6b7280' }}>{variable.type}: </span>
                <span style={{ fontWeight: '500' }}>{`{{${variable.name}}}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onUseFlow}
          style={{
            flex: 1,
            padding: '14px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '16px'
          }}
        >
          Use This Flow
        </button>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: '14px 24px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '16px'
            }}
          >
            Generate New
          </button>
        )}
      </div>
    </div>
  );
}

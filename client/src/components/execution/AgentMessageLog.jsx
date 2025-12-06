import React, { useState, useRef, useEffect } from 'react';

const AgentMessageLog = ({ messages = [] }) => {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getMessageTypeBadge = (type) => {
    const badges = {
      task: { bg: '#dbeafe', color: '#1d4ed8', label: 'Task' },
      result: { bg: '#dcfce7', color: '#166534', label: 'Result' },
      question: { bg: '#fef3c7', color: '#92400e', label: 'Question' },
      error: { bg: '#fee2e2', color: '#dc2626', label: 'Error' },
      info: { bg: '#e0e7ff', color: '#4338ca', label: 'Info' },
      handoff: { bg: '#f3e8ff', color: '#7c3aed', label: 'Handoff' }
    };
    return badges[type] || badges.info;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const truncateContent = (content, maxLength = 150) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="agent-message-log">
      <div className="log-header">
        <h3>Agent Messages</h3>
        <span className="message-count">{messages.length} messages</span>
      </div>

      <div className="message-list" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">💬</span>
            <p>No agent messages yet</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const badge = getMessageTypeBadge(msg.type);
            const isExpanded = expandedIds.has(msg.id || index);

            return (
              <div key={msg.id || index} className="message-item">
                <div className="message-header">
                  <div className="agents-flow">
                    <span className="agent-name from">{msg.fromAgent || 'System'}</span>
                    <span className="arrow">→</span>
                    <span className="agent-name to">{msg.toAgent || 'All'}</span>
                  </div>
                  <div className="message-meta">
                    <span
                      className="type-badge"
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                    <span className="timestamp">{formatTimestamp(msg.timestamp)}</span>
                  </div>
                </div>

                <div
                  className={`message-content ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => toggleExpand(msg.id || index)}
                >
                  {isExpanded ? msg.content : truncateContent(msg.content)}
                </div>

                {msg.content && msg.content.length > 150 && (
                  <button
                    className="expand-btn"
                    onClick={() => toggleExpand(msg.id || index)}
                  >
                    {isExpanded ? '▲ Collapse' : '▼ Expand'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .agent-message-log {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .log-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }

        .message-count {
          font-size: 12px;
          color: #64748b;
        }

        .message-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #94a3b8;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .empty-state p {
          margin: 0;
          font-size: 14px;
        }

        .message-item {
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .message-item:last-child {
          margin-bottom: 0;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .agents-flow {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .agent-name {
          font-size: 13px;
          font-weight: 600;
        }

        .agent-name.from {
          color: #4f46e5;
        }

        .agent-name.to {
          color: #059669;
        }

        .arrow {
          color: #94a3b8;
          font-size: 12px;
        }

        .message-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .type-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .timestamp {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        .message-content {
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
          cursor: pointer;
          padding: 8px;
          background: white;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          word-break: break-word;
        }

        .message-content.expanded {
          white-space: pre-wrap;
        }

        .expand-btn {
          display: block;
          width: 100%;
          margin-top: 8px;
          padding: 4px;
          background: none;
          border: none;
          color: #64748b;
          font-size: 11px;
          cursor: pointer;
          text-align: center;
        }

        .expand-btn:hover {
          color: #1e293b;
        }
      `}</style>
    </div>
  );
};

export default AgentMessageLog;

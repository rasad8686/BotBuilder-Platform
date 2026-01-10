import React from 'react';
import { Brain, Link, Trash2 } from 'lucide-react';

const KBCard = ({ kb, isSelected, onSelect, onDelete, onAssign }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'processing': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div
      className={`kb-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="kb-card-header">
        <span className="kb-icon"><Brain size={24} /></span>
        <div className="kb-info">
          <h4>{kb.name}</h4>
          <div className="kb-meta">
            <span>{kb.document_count || 0} docs</span>
            <span>{kb.total_chunks || 0} chunks</span>
          </div>
        </div>
        <span
          className="kb-status"
          style={{ background: getStatusColor(kb.status) }}
        ></span>
      </div>

      <div className="kb-card-actions">
        <button
          className="btn-assign"
          onClick={(e) => {
            e.stopPropagation();
            onAssign && onAssign();
          }}
          title="Assign to Agents"
        >
          <Link size={12} />
        </button>
        <button
          className="btn-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <style>{`
        .kb-card {
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .kb-card:hover {
          border-color: #667eea;
          background: #f8f9ff;
        }

        .kb-card.selected {
          border-color: #667eea;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        }

        .kb-card-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .kb-icon {
          font-size: 24px;
        }

        .kb-info {
          flex: 1;
          min-width: 0;
        }

        .kb-info h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #1a1a2e;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kb-meta {
          display: flex;
          gap: 8px;
          margin-top: 4px;
          font-size: 11px;
          color: #6b7280;
        }

        .kb-status {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .kb-card-actions {
          position: absolute;
          top: 8px;
          right: 8px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .kb-card:hover .kb-card-actions {
          opacity: 1;
        }

        .btn-assign {
          background: #dbeafe;
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
          margin-right: 4px;
        }

        .btn-assign:hover {
          background: #bfdbfe;
        }

        .btn-delete {
          background: #fee2e2;
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        }

        .btn-delete:hover {
          background: #fecaca;
        }
      `}</style>
    </div>
  );
};

export default KBCard;

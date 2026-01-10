import React from 'react';
import { Globe, Database, Code, Bug, Mail, Wrench, Bot, Play, Pencil, Link, Trash2 } from 'lucide-react';

const ToolCard = ({ tool, onEdit, onDelete, onTest, onAssign }) => {
  const getToolIcon = (type) => {
    const icons = {
      'http_request': Globe,
      'http': Globe,
      'api': Globe,
      'database_query': Database,
      'database': Database,
      'sql': Database,
      'code_execution': Code,
      'code': Code,
      'javascript': Code,
      'web_scraper': Bug,
      'scraper': Bug,
      'email': Mail,
      'smtp': Mail,
      'custom': Wrench
    };
    return icons[type] || Wrench;
  };

  const getTypeLabel = (type) => {
    const labels = {
      'http_request': 'HTTP/API',
      'http': 'HTTP/API',
      'api': 'HTTP/API',
      'database_query': 'Database',
      'database': 'Database',
      'sql': 'Database',
      'code_execution': 'Code',
      'code': 'Code',
      'javascript': 'JavaScript',
      'web_scraper': 'Web Scraper',
      'scraper': 'Web Scraper',
      'email': 'Email',
      'smtp': 'Email',
      'custom': 'Custom'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type) => {
    const colors = {
      'http_request': '#3b82f6',
      'http': '#3b82f6',
      'api': '#3b82f6',
      'database_query': '#10b981',
      'database': '#10b981',
      'sql': '#10b981',
      'code_execution': '#f59e0b',
      'code': '#f59e0b',
      'javascript': '#f59e0b',
      'web_scraper': '#8b5cf6',
      'scraper': '#8b5cf6',
      'email': '#ec4899',
      'smtp': '#ec4899',
      'custom': '#6b7280'
    };
    return colors[type] || '#6b7280';
  };

  const IconComponent = getToolIcon(tool.tool_type);

  return (
    <div className={`tool-card ${!tool.is_active ? 'inactive' : ''}`}>
      <div className="tool-card-header">
        <div className="tool-icon"><IconComponent size={28} /></div>
        <div className="tool-info">
          <h3 className="tool-name">{tool.name}</h3>
          <span
            className="tool-type-badge"
            style={{ backgroundColor: getTypeColor(tool.tool_type) }}
          >
            {getTypeLabel(tool.tool_type)}
          </span>
        </div>
        <div className={`tool-status ${tool.is_active ? 'active' : 'inactive'}`}>
          {tool.is_active ? 'Active' : 'Inactive'}
        </div>
      </div>

      <p className="tool-description">
        {tool.description || 'No description provided'}
      </p>

      {tool.assignedAgentsCount !== undefined && (
        <div className="tool-meta">
          <span className="meta-item">
            <Bot size={14} /> {tool.assignedAgentsCount} agent{tool.assignedAgentsCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="tool-actions">
        <button className="btn btn-test" onClick={onTest} title="Test Tool">
          <Play size={14} /> Test
        </button>
        <button className="btn btn-edit" onClick={onEdit} title="Edit Tool">
          <Pencil size={14} /> Edit
        </button>
        {onAssign && (
          <button className="btn btn-assign" onClick={onAssign} title="Assign to Agent">
            <Link size={14} /> Assign
          </button>
        )}
        <button className="btn btn-delete" onClick={onDelete} title="Delete Tool">
          <Trash2 size={14} />
        </button>
      </div>

      <style>{`
        .tool-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          border: 1px solid #e5e7eb;
          transition: all 0.2s;
        }

        .tool-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        }

        .tool-card.inactive {
          opacity: 0.7;
          background: #f9fafb;
        }

        .tool-card-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .tool-icon {
          font-size: 32px;
          line-height: 1;
        }

        .tool-info {
          flex: 1;
        }

        .tool-name {
          margin: 0 0 6px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1a1a2e;
        }

        .tool-type-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
        }

        .tool-status {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .tool-status.active {
          background: #dcfce7;
          color: #16a34a;
        }

        .tool-status.inactive {
          background: #fee2e2;
          color: #dc2626;
        }

        .tool-description {
          color: #6b7280;
          font-size: 14px;
          margin: 0 0 12px 0;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .tool-meta {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        .meta-item {
          font-size: 13px;
          color: #6b7280;
        }

        .tool-actions {
          display: flex;
          gap: 8px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        .tool-actions .btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .btn-test {
          background: #ecfdf5;
          color: #059669;
        }

        .btn-test:hover {
          background: #d1fae5;
        }

        .btn-edit {
          background: #eff6ff;
          color: #2563eb;
        }

        .btn-edit:hover {
          background: #dbeafe;
        }

        .btn-assign {
          background: #fef3c7;
          color: #d97706;
        }

        .btn-assign:hover {
          background: #fde68a;
        }

        .btn-delete {
          background: #fef2f2;
          color: #dc2626;
          flex: 0;
          padding: 8px;
        }

        .btn-delete:hover {
          background: #fee2e2;
        }
      `}</style>
    </div>
  );
};

export default ToolCard;

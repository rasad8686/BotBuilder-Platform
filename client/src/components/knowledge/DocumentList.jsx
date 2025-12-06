import React from 'react';

const DocumentList = ({ documents, onDelete, onRefresh }) => {
  const getTypeIcon = (type) => {
    const icons = {
      'txt': '📄',
      'text': '📄',
      'md': '📝',
      'markdown': '📝',
      'pdf': '📕',
      'docx': '📘',
      'doc': '📘',
      'url': '🌐',
      'web': '🌐'
    };
    return icons[type?.toLowerCase()] || '📄';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { bg: '#fef3c7', color: '#d97706', text: 'Pending' },
      'processing': { bg: '#dbeafe', color: '#2563eb', text: 'Processing' },
      'completed': { bg: '#dcfce7', color: '#16a34a', text: 'Completed' },
      'failed': { bg: '#fee2e2', color: '#dc2626', text: 'Failed' }
    };
    return badges[status] || badges.pending;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (documents.length === 0) {
    return (
      <div className="doc-list-empty">
        <span className="empty-icon">📂</span>
        <h3>No Documents</h3>
        <p>Upload documents to build your knowledge base</p>
        <style>{`
          .doc-list-empty {
            text-align: center;
            padding: 48px 24px;
            color: #6b7280;
          }
          .doc-list-empty .empty-icon {
            font-size: 48px;
            display: block;
            margin-bottom: 12px;
          }
          .doc-list-empty h3 {
            margin: 0 0 8px 0;
            color: #374151;
          }
          .doc-list-empty p {
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="document-list">
      <div className="list-header">
        <span className="count">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
        <button className="btn-refresh" onClick={onRefresh} title="Refresh">
          🔄
        </button>
      </div>

      <div className="doc-table">
        <div className="table-header">
          <span className="col-name">Name</span>
          <span className="col-type">Type</span>
          <span className="col-status">Status</span>
          <span className="col-chunks">Chunks</span>
          <span className="col-size">Size</span>
          <span className="col-date">Added</span>
          <span className="col-actions"></span>
        </div>

        {documents.map(doc => {
          const status = getStatusBadge(doc.status);
          return (
            <div key={doc.id} className="table-row">
              <span className="col-name">
                <span className="doc-icon">{getTypeIcon(doc.type)}</span>
                <span className="doc-name" title={doc.name}>{doc.name}</span>
              </span>
              <span className="col-type">{doc.type?.toUpperCase()}</span>
              <span className="col-status">
                <span
                  className="status-badge"
                  style={{ background: status.bg, color: status.color }}
                >
                  {status.text}
                </span>
              </span>
              <span className="col-chunks">{doc.chunk_count || 0}</span>
              <span className="col-size">{formatFileSize(doc.file_size)}</span>
              <span className="col-date">{formatDate(doc.created_at)}</span>
              <span className="col-actions">
                <button
                  className="btn-delete"
                  onClick={() => onDelete(doc.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        .document-list {
          padding: 12px 0;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .count {
          font-size: 14px;
          color: #6b7280;
        }

        .btn-refresh {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .btn-refresh:hover {
          background: #f3f4f6;
        }

        .doc-table {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .table-header {
          display: grid;
          grid-template-columns: 2fr 80px 100px 70px 80px 120px 50px;
          gap: 12px;
          padding: 12px 16px;
          background: #f9fafb;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          border-bottom: 1px solid #e5e7eb;
        }

        .table-row {
          display: grid;
          grid-template-columns: 2fr 80px 100px 70px 80px 120px 50px;
          gap: 12px;
          padding: 12px 16px;
          align-items: center;
          border-bottom: 1px solid #f3f4f6;
          font-size: 14px;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-row:hover {
          background: #f9fafb;
        }

        .col-name {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .doc-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .doc-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #1a1a2e;
          font-weight: 500;
        }

        .col-type {
          color: #6b7280;
          font-size: 12px;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .col-chunks,
        .col-size,
        .col-date {
          color: #6b7280;
          font-size: 13px;
        }

        .btn-delete {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          padding: 4px;
          border-radius: 4px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .table-row:hover .btn-delete {
          opacity: 1;
        }

        .btn-delete:hover {
          background: #fee2e2;
        }

        @media (max-width: 900px) {
          .table-header,
          .table-row {
            grid-template-columns: 1fr 80px 100px 50px;
          }
          .col-size,
          .col-date,
          .col-chunks {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default DocumentList;

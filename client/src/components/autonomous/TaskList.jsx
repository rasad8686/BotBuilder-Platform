import React from 'react';

const statusColors = {
  pending: { bg: '#fff3cd', color: '#856404', icon: '⏳' },
  running: { bg: '#cce5ff', color: '#004085', icon: '🔄' },
  completed: { bg: '#d4edda', color: '#155724', icon: '✅' },
  failed: { bg: '#f8d7da', color: '#721c24', icon: '❌' }
};

const TaskList = ({ tasks, selectedTaskId, onSelectTask, onCreateTask }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // Less than a minute
    if (diff < 60000) {
      return 'Just now';
    }
    // Less than an hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    // Otherwise show date
    return date.toLocaleDateString();
  };

  return (
    <div className="task-list-container">
      {/* Header */}
      <div className="task-list-header">
        <h3>Tasks ({tasks.length})</h3>
        {onCreateTask && (
          <button className="btn-create" onClick={onCreateTask}>
            + New
          </button>
        )}
      </div>

      {/* Task List */}
      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>No tasks yet</p>
            {onCreateTask && (
              <button className="btn-create-first" onClick={onCreateTask}>
                Create First Task
              </button>
            )}
          </div>
        ) : (
          tasks.map(task => {
            const status = statusColors[task.status] || statusColors.pending;
            const isSelected = selectedTaskId === task.id;
            const progress = task.total_steps > 0
              ? Math.round((task.completed_steps / task.total_steps) * 100)
              : 0;

            return (
              <div
                key={task.id}
                className={`task-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectTask(task)}
              >
                {/* Status & ID */}
                <div className="task-header">
                  <span
                    className="task-status"
                    style={{ background: status.bg, color: status.color }}
                  >
                    {status.icon} {task.status}
                  </span>
                  <span className="task-id">#{task.id}</span>
                </div>

                {/* Description */}
                <p className="task-description">
                  {task.task_description?.length > 80
                    ? task.task_description.substring(0, 80) + '...'
                    : task.task_description}
                </p>

                {/* Progress Bar (for running tasks) */}
                {task.status === 'running' && task.total_steps > 0 && (
                  <div className="task-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">
                      {task.completed_steps}/{task.total_steps}
                    </span>
                  </div>
                )}

                {/* Meta Info */}
                <div className="task-meta">
                  <span className="meta-item">
                    📊 {task.completed_steps || 0}/{task.total_steps || 0} steps
                  </span>
                  <span className="meta-item">
                    🕐 {formatDate(task.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .task-list-container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .task-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .task-list-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: #1a1a2e;
        }

        .btn-create {
          padding: 6px 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-create:hover {
          background: #5a6fd6;
        }

        .task-list {
          flex: 1;
          overflow-y: auto;
        }

        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: #6c757d;
        }

        .empty-icon {
          font-size: 40px;
          display: block;
          margin-bottom: 12px;
        }

        .empty-state p {
          margin: 0 0 16px 0;
          font-size: 14px;
        }

        .btn-create-first {
          padding: 10px 20px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .task-item {
          padding: 16px 20px;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
          transition: background 0.2s;
        }

        .task-item:hover {
          background: #f8f9fa;
        }

        .task-item.selected {
          background: #f0f4ff;
          border-left: 3px solid #667eea;
        }

        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .task-status {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .task-id {
          font-size: 12px;
          color: #adb5bd;
          font-weight: 500;
        }

        .task-description {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #1a1a2e;
          line-height: 1.4;
        }

        .task-progress {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          border-radius: 3px;
          transition: width 0.3s ease;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .progress-text {
          font-size: 11px;
          color: #6c757d;
          font-weight: 500;
          min-width: 40px;
        }

        .task-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #6c757d;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      `}</style>
    </div>
  );
};

export default TaskList;

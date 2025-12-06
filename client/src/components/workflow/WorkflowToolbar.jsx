import React from 'react';

const WorkflowToolbar = ({
  workflowName,
  onNameChange,
  onSave,
  onRun,
  onClear,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  isSaving,
  isRunning,
  canUndo,
  canRedo
}) => {
  return (
    <div className="workflow-toolbar">
      <div className="toolbar-left">
        <input
          type="text"
          className="workflow-name-input"
          value={workflowName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Workflow name..."
        />
      </div>

      <div className="toolbar-center">
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
          >
            ↩️
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
          >
            ↪️
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={onZoomOut}
            title="Zoom Out"
          >
            ➖
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={onZoomIn}
            title="Zoom In"
          >
            ➕
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={onFitView}
            title="Fit View"
          >
            ⛶
          </button>
        </div>

        <div className="toolbar-divider" />

        <button
          type="button"
          className="toolbar-btn danger"
          onClick={onClear}
          title="Clear Canvas"
        >
          🗑️ Clear
        </button>
      </div>

      <div className="toolbar-right">
        <button
          type="button"
          className="toolbar-btn secondary"
          onClick={onRun}
          disabled={isRunning}
          title="Test Workflow"
        >
          {isRunning ? '⏳ Running...' : '▶️ Run Test'}
        </button>

        <button
          type="button"
          className="toolbar-btn primary"
          onClick={onSave}
          disabled={isSaving}
          title="Save Workflow"
        >
          {isSaving ? '💾 Saving...' : '💾 Save'}
        </button>
      </div>

      <style>{`
        .workflow-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: white;
          border-bottom: 1px solid #e9ecef;
          gap: 20px;
        }

        .toolbar-left {
          flex: 1;
          max-width: 300px;
        }

        .workflow-name-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
        }

        .workflow-name-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .toolbar-center {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-group {
          display: flex;
          gap: 4px;
        }

        .toolbar-divider {
          width: 1px;
          height: 24px;
          background: #dee2e6;
          margin: 0 8px;
        }

        .toolbar-right {
          display: flex;
          gap: 12px;
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          background: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toolbar-btn:hover:not(:disabled) {
          background: #f8f9fa;
          border-color: #adb5bd;
        }

        .toolbar-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toolbar-btn.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
        }

        .toolbar-btn.primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .toolbar-btn.secondary {
          background: #e8f5e9;
          color: #2e7d32;
          border-color: #a5d6a7;
        }

        .toolbar-btn.secondary:hover:not(:disabled) {
          background: #c8e6c9;
        }

        .toolbar-btn.danger {
          color: #c53030;
        }

        .toolbar-btn.danger:hover:not(:disabled) {
          background: #fff5f5;
          border-color: #feb2b2;
        }
      `}</style>
    </div>
  );
};

export default WorkflowToolbar;

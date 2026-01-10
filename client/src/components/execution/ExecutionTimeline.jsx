import React from 'react';
import { Clock, RefreshCw, CheckCircle, XCircle, Circle } from 'lucide-react';

const ExecutionTimeline = ({ steps = [], currentStep, onSelectStep, selectedStepId }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock size={16} />;
      case 'running': return <RefreshCw size={16} className="animate-spin" />;
      case 'completed': return <CheckCircle size={16} />;
      case 'failed': return <XCircle size={16} />;
      default: return <Circle size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#9ca3af';
      case 'running': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      default: return '#e5e7eb';
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const calculateProgress = (step) => {
    if (step.status === 'completed') return 100;
    if (step.status === 'pending') return 0;
    if (step.status === 'running' && step.startTime) {
      const elapsed = Date.now() - new Date(step.startTime).getTime();
      const estimated = step.estimatedDuration || 5000;
      return Math.min(95, (elapsed / estimated) * 100);
    }
    return 0;
  };

  return (
    <div className="execution-timeline">
      <div className="timeline-header">
        <h3>Execution Timeline</h3>
        <span className="step-count">{steps.length} steps</span>
      </div>

      <div className="timeline-list">
        {steps.length === 0 ? (
          <div className="empty-state">
            No execution steps yet
          </div>
        ) : (
          steps.map((step, index) => (
            <div
              key={step.id || index}
              className={`timeline-step ${step.status} ${selectedStepId === step.id ? 'selected' : ''} ${currentStep?.id === step.id ? 'current' : ''}`}
              onClick={() => onSelectStep(step)}
            >
              <div className="step-connector">
                <div className="connector-line top" />
                <div className="step-icon" style={{ borderColor: getStatusColor(step.status) }}>
                  {getStatusIcon(step.status)}
                </div>
                <div className="connector-line bottom" />
              </div>

              <div className="step-content">
                <div className="step-header">
                  <span className="step-name">{step.agentName || `Step ${index + 1}`}</span>
                  <span className="step-duration">{formatDuration(step.duration)}</span>
                </div>

                <div className="step-role">{step.agentRole || 'Agent'}</div>

                {step.status === 'running' && (
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${calculateProgress(step)}%` }}
                    />
                  </div>
                )}

                {step.status === 'failed' && step.error && (
                  <div className="step-error">{step.error}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .execution-timeline {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .timeline-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }

        .step-count {
          font-size: 12px;
          color: #64748b;
        }

        .timeline-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .empty-state {
          padding: 32px;
          text-align: center;
          color: #94a3b8;
          font-size: 14px;
        }

        .timeline-step {
          display: flex;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .timeline-step:hover {
          background: #f8fafc;
        }

        .timeline-step.selected {
          background: #eff6ff;
        }

        .timeline-step.current {
          background: #f0fdf4;
        }

        .step-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-right: 12px;
        }

        .connector-line {
          width: 2px;
          height: 12px;
          background: #e2e8f0;
        }

        .timeline-step:first-child .connector-line.top {
          visibility: hidden;
        }

        .timeline-step:last-child .connector-line.bottom {
          visibility: hidden;
        }

        .step-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          font-size: 12px;
        }

        .timeline-step.running .step-icon {
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .step-content {
          flex: 1;
          min-width: 0;
        }

        .step-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .step-name {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }

        .step-duration {
          font-size: 12px;
          color: #64748b;
          font-family: monospace;
        }

        .step-role {
          font-size: 12px;
          color: #64748b;
        }

        .progress-bar {
          margin-top: 8px;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transition: width 0.3s ease;
        }

        .step-error {
          margin-top: 8px;
          padding: 8px;
          background: #fef2f2;
          border-radius: 6px;
          font-size: 12px;
          color: #dc2626;
        }
      `}</style>
    </div>
  );
};

export default ExecutionTimeline;

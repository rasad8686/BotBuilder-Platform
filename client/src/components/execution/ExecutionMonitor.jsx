import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, AlertTriangle } from 'lucide-react';
import ExecutionTimeline from './ExecutionTimeline';
import AgentMessageLog from './AgentMessageLog';
import ExecutionStats from './ExecutionStats';
import StepDetailPanel from './StepDetailPanel';
import LiveAgentView from './LiveAgentView';
import useExecutionSocket from '../../hooks/useExecutionSocket';

const ExecutionMonitor = ({ workflowId, onClose, onExecutionUpdate }) => {
  const [testInput, setTestInput] = useState('');
  const [selectedStep, setSelectedStep] = useState(null);
  const [, setExecutionId] = useState(null);

  const {
    status,
    currentStep,
    steps,
    messages,
    stats,
    error,
    connect,
    disconnect,
    startExecution,
    pauseExecution,
    stopExecution
  } = useExecutionSocket(workflowId);

  // Send execution updates to parent (for Debug Panel)
  useEffect(() => {
    if (onExecutionUpdate) {
      onExecutionUpdate({
        status,
        currentStep,
        steps,
        messages,
        error
      });
    }
  }, [status, currentStep, steps, messages, error, onExecutionUpdate]);

  const token = localStorage.getItem('token');

  const handleStart = async () => {
    if (!testInput.trim()) {
      alert('Please enter a test message');
      return;
    }

    try {
      // Start UI state first
      startExecution();

      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ input: { message: testInput } })
      });

      if (!res.ok) throw new Error('Failed to start execution');

      const data = await res.json();
      const execId = data.executionId || data.id;
      setExecutionId(execId);

      // Connect to socket room
      connect(execId);

      // Tell backend we're ready to receive events
      setTimeout(() => {
        fetch(`/api/workflows/${workflowId}/executions/${execId}/ready`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(() => {});
      }, 100);

    } catch (err) {
      alert('Error starting execution: ' + err.message);
    }
  };

  const handleStop = () => {
    stopExecution();
    disconnect();
  };

  const handlePause = () => {
    pauseExecution();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'running': return '#10b981';
      case 'paused': return '#f59e0b';
      case 'completed': return '#3b82f6';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="execution-monitor">
      <div className="monitor-header">
        <div className="header-left">
          <h2>Execution Monitor</h2>
          <span className="status-badge" style={{ backgroundColor: getStatusColor() }}>
            {status || 'idle'}
          </span>
        </div>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="input-section">
        <div className="input-wrapper">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Enter test message..."
            disabled={status === 'running'}
          />
          <div className="control-buttons">
            {status !== 'running' && status !== 'paused' && (
              <button className="btn-start" onClick={handleStart}>
                <Play size={16} /> Start
              </button>
            )}
            {status === 'running' && (
              <>
                <button className="btn-pause" onClick={handlePause}>
                  <Pause size={16} /> Pause
                </button>
                <button className="btn-stop" onClick={handleStop}>
                  <Square size={16} /> Stop
                </button>
              </>
            )}
            {status === 'paused' && (
              <>
                <button className="btn-start" onClick={startExecution}>
                  <Play size={16} /> Resume
                </button>
                <button className="btn-stop" onClick={handleStop}>
                  <Square size={16} /> Stop
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={16} style={{ marginRight: '8px', display: 'inline' }} /> {error}
        </div>
      )}

      <div className="monitor-content">
        <div className="left-panel">
          <LiveAgentView
            currentStep={currentStep}
            status={status}
          />

          <ExecutionTimeline
            steps={steps}
            currentStep={currentStep}
            onSelectStep={setSelectedStep}
            selectedStepId={selectedStep?.id}
          />
        </div>

        <div className="center-panel">
          <AgentMessageLog messages={messages} />
        </div>

        <div className="right-panel">
          <ExecutionStats stats={stats} />

          {selectedStep && (
            <StepDetailPanel
              step={selectedStep}
              onClose={() => setSelectedStep(null)}
            />
          )}
        </div>
      </div>

      <style>{`
        .execution-monitor {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f8fafc;
        }

        .monitor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-left h2 {
          margin: 0;
          font-size: 18px;
          color: #1e293b;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #64748b;
          cursor: pointer;
        }

        .close-btn:hover {
          color: #1e293b;
        }

        .input-section {
          padding: 16px 20px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
        }

        .input-wrapper {
          display: flex;
          gap: 12px;
        }

        .input-wrapper input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
        }

        .input-wrapper input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .input-wrapper input:disabled {
          background: #f1f5f9;
        }

        .control-buttons {
          display: flex;
          gap: 8px;
        }

        .control-buttons button {
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-start {
          background: #10b981;
          color: white;
        }

        .btn-start:hover {
          background: #059669;
        }

        .btn-pause {
          background: #f59e0b;
          color: white;
        }

        .btn-pause:hover {
          background: #d97706;
        }

        .btn-stop {
          background: #ef4444;
          color: white;
        }

        .btn-stop:hover {
          background: #dc2626;
        }

        .error-banner {
          padding: 12px 20px;
          background: #fef2f2;
          color: #dc2626;
          border-bottom: 1px solid #fecaca;
          font-size: 14px;
        }

        .monitor-content {
          flex: 1;
          display: flex;
          overflow: hidden;
          padding: 20px;
          gap: 20px;
        }

        .left-panel {
          width: 300px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
        }

        .center-panel {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .right-panel {
          width: 320px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
};

export default ExecutionMonitor;

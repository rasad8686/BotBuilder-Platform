import React, { useState, useEffect } from 'react';

const LiveAgentView = ({ currentStep, status }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (status === 'running' && currentStep) {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
      }, 500);
      return () => clearInterval(interval);
    }
    setDots('');
  }, [status, currentStep]);

  const getRoleIcon = (role) => {
    const icons = {
      orchestrator: '🎯',
      researcher: '🔍',
      writer: '✍️',
      analyzer: '📊',
      reviewer: '✅',
      router: '🔀',
      custom: '⚙️'
    };
    return icons[role?.toLowerCase()] || '🤖';
  };

  if (!currentStep || status !== 'running') {
    return (
      <div className="live-agent-view idle">
        <div className="idle-content">
          <span className="idle-icon">🤖</span>
          <p>{status === 'completed' ? 'Execution completed' : 'Waiting for execution...'}</p>
        </div>

        <style>{`
          .live-agent-view {
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
          }

          .live-agent-view.idle {
            padding: 32px;
            text-align: center;
          }

          .idle-content {
            color: #94a3b8;
          }

          .idle-icon {
            font-size: 48px;
            display: block;
            margin-bottom: 12px;
            opacity: 0.5;
          }

          .idle-content p {
            margin: 0;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="live-agent-view active">
      <div className="view-header">
        <span className="live-badge">LIVE</span>
        <span className="agent-name">{currentStep.agentName || 'Agent'}</span>
      </div>

      <div className="agent-display">
        <div className="agent-avatar">
          <span className="avatar-icon">{getRoleIcon(currentStep.agentRole)}</span>
          <div className="pulse-ring" />
        </div>

        <div className="thinking-indicator">
          <span>Thinking{dots}</span>
        </div>

        <div className="agent-role">{currentStep.agentRole || 'Processing'}</div>
      </div>

      <div className="live-content">
        {currentStep.input && (
          <div className="content-section">
            <h4>📥 Input</h4>
            <div className="content-box">
              {typeof currentStep.input === 'object'
                ? JSON.stringify(currentStep.input, null, 2)
                : currentStep.input}
            </div>
          </div>
        )}

        {currentStep.partialOutput && (
          <div className="content-section">
            <h4>📤 Output (streaming)</h4>
            <div className="content-box streaming">
              {currentStep.partialOutput}
              <span className="cursor">|</span>
            </div>
          </div>
        )}
      </div>

      <div className="progress-section">
        <div className="progress-bar">
          <div className="progress-fill" />
        </div>
        <span className="progress-text">Processing...</span>
      </div>

      <style>{`
        .live-agent-view {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .live-agent-view.active {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .view-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .live-badge {
          padding: 2px 8px;
          background: white;
          color: #10b981;
          font-size: 10px;
          font-weight: 700;
          border-radius: 4px;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .agent-name {
          color: white;
          font-size: 14px;
          font-weight: 600;
        }

        .agent-display {
          padding: 24px;
          text-align: center;
          background: #f0fdf4;
        }

        .agent-avatar {
          position: relative;
          display: inline-block;
          margin-bottom: 12px;
        }

        .avatar-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: white;
          border-radius: 50%;
          font-size: 32px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 1;
        }

        .pulse-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 80px;
          height: 80px;
          border: 3px solid #10b981;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: pulse-ring 1.5s infinite;
        }

        @keyframes pulse-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.3);
            opacity: 0;
          }
        }

        .thinking-indicator {
          font-size: 16px;
          font-weight: 600;
          color: #10b981;
          margin-bottom: 4px;
        }

        .agent-role {
          font-size: 12px;
          color: #64748b;
        }

        .live-content {
          padding: 16px;
          max-height: 200px;
          overflow-y: auto;
        }

        .content-section {
          margin-bottom: 12px;
        }

        .content-section:last-child {
          margin-bottom: 0;
        }

        .content-section h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        .content-box {
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          font-size: 12px;
          font-family: monospace;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 80px;
          overflow-y: auto;
        }

        .content-box.streaming {
          background: #1e293b;
          color: #e2e8f0;
        }

        .cursor {
          animation: cursor-blink 1s infinite;
        }

        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .progress-section {
          padding: 12px 16px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }

        .progress-bar {
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          width: 40%;
          background: linear-gradient(90deg, #10b981, #059669);
          border-radius: 2px;
          animation: progress-slide 1.5s infinite;
        }

        @keyframes progress-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }

        .progress-text {
          font-size: 11px;
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

export default LiveAgentView;

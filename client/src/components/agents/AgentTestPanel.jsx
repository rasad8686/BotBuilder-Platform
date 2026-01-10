import React, { useState } from 'react';
import { AlertTriangle, Ticket, Clock, CheckCircle, XCircle, Play } from 'lucide-react';

const AgentTestPanel = ({ agent, onClose }) => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTest = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/agents/${agent.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ input: input.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Test failed');
      }

      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatOutput = (output) => {
    if (!output) return 'No output';

    if (output.type === 'json') {
      return JSON.stringify(output.data, null, 2);
    }

    return output.data || output.raw || JSON.stringify(output, null, 2);
  };

  return (
    <div className="test-panel-overlay">
      <div className="test-panel">
        <div className="test-panel-header">
          <div className="header-info">
            <h2>Test Agent</h2>
            <span className="agent-name">{agent.name}</span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="test-panel-body">
          <div className="input-section">
            <label>Test Input</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a message to test the agent..."
              rows={4}
            />
            <button
              className="btn btn-test"
              onClick={handleTest}
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Running...
                </>
              ) : (
                <><Play size={14} /> Run Test</>
              )}
            </button>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon"><AlertTriangle size={16} /></span>
              {error}
            </div>
          )}

          {response && (
            <div className="response-section">
              <div className="response-header">
                <h3>Response</h3>
                <div className="response-meta">
                  {response.tokensUsed && (
                    <span className="meta-badge">
                      <Ticket size={14} /> {response.tokensUsed} tokens
                    </span>
                  )}
                  {response.durationMs && (
                    <span className="meta-badge">
                      <Clock size={14} /> {response.durationMs}ms
                    </span>
                  )}
                </div>
              </div>

              <div className={`response-status ${response.success ? 'success' : 'failed'}`}>
                {response.success ? <><CheckCircle size={16} /> Success</> : <><XCircle size={16} /> Failed</>}
              </div>

              <div className="response-content">
                <pre>{formatOutput(response.output)}</pre>
              </div>
            </div>
          )}

          <div className="agent-info">
            <h4>Agent Configuration</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Role</span>
                <span className="info-value">{agent.role}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Provider</span>
                <span className="info-value">{agent.model_provider}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Model</span>
                <span className="info-value">{agent.model_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Temperature</span>
                <span className="info-value">{agent.temperature}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .test-panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .test-panel {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .test-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e9ecef;
        }

        .header-info h2 {
          margin: 0;
          font-size: 20px;
          color: #1a1a2e;
        }

        .agent-name {
          font-size: 14px;
          color: #6c757d;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 28px;
          color: #6c757d;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .test-panel-body {
          padding: 24px;
          overflow-y: auto;
        }

        .input-section {
          margin-bottom: 24px;
        }

        .input-section label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #495057;
        }

        .input-section textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
        }

        .input-section textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .btn-test {
          margin-top: 12px;
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-test:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
        }

        .btn-test:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          background: #fff5f5;
          border: 1px solid #feb2b2;
          color: #c53030;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .response-section {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .response-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .response-header h3 {
          margin: 0;
          font-size: 16px;
          color: #1a1a2e;
        }

        .response-meta {
          display: flex;
          gap: 8px;
        }

        .meta-badge {
          background: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          color: #495057;
        }

        .response-status {
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .response-status.success {
          background: #d4edda;
          color: #155724;
        }

        .response-status.failed {
          background: #f8d7da;
          color: #721c24;
        }

        .response-content {
          background: white;
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
        }

        .response-content pre {
          margin: 0;
          font-size: 13px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .agent-info {
          background: #f0f4f8;
          border-radius: 12px;
          padding: 16px;
        }

        .agent-info h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #6c757d;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .info-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #adb5bd;
        }

        .info-value {
          font-size: 13px;
          font-weight: 600;
          color: #495057;
        }
      `}</style>
    </div>
  );
};

export default AgentTestPanel;

import React, { useState } from 'react';

const ToolTestPanel = ({ tool, onClose, onExecute }) => {
  const [input, setInput] = useState('{}');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateInputFromSchema = (schema) => {
    if (!schema || !schema.properties) {
      return {};
    }

    const generated = {};
    Object.entries(schema.properties).forEach(([key, prop]) => {
      switch (prop.type) {
        case 'string':
          generated[key] = prop.default || '';
          break;
        case 'number':
        case 'integer':
          generated[key] = prop.default || 0;
          break;
        case 'boolean':
          generated[key] = prop.default || false;
          break;
        case 'array':
          generated[key] = prop.default || [];
          break;
        case 'object':
          generated[key] = prop.default || {};
          break;
        default:
          generated[key] = null;
      }
    });
    return generated;
  };

  const handleGenerateInput = () => {
    const generated = generateInputFromSchema(tool.input_schema);
    setInput(JSON.stringify(generated, null, 2));
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let parsedInput;
      try {
        parsedInput = JSON.parse(input);
      } catch (e) {
        throw new Error('Invalid JSON input');
      }

      const response = await onExecute(tool.id, parsedInput);
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!result) return null;

    if (result.success) {
      return <span className="status-badge success">Success</span>;
    } else {
      return <span className="status-badge error">Failed</span>;
    }
  };

  return (
    <div className="tool-test-panel">
      <div className="panel-header">
        <h2>Test Tool: {tool.name}</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-content">
        <div className="input-section">
          <div className="section-header">
            <h3>Input</h3>
            {tool.input_schema && (
              <button
                type="button"
                className="btn btn-small btn-secondary"
                onClick={handleGenerateInput}
              >
                Generate from Schema
              </button>
            )}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"key": "value"}'
            className="code-input"
            rows={10}
          />
        </div>

        <div className="action-section">
          <button
            className="btn btn-primary btn-run"
            onClick={handleRun}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Running...
              </>
            ) : (
              <>▶️ Run Test</>
            )}
          </button>
        </div>

        {(result || error) && (
          <div className="result-section">
            <div className="section-header">
              <h3>Result</h3>
              {getStatusBadge()}
            </div>

            {error && (
              <div className="error-box">
                <strong>Error:</strong> {error}
              </div>
            )}

            {result && (
              <>
                <div className="result-meta">
                  <span className="meta-item">
                    ⏱️ {result.duration_ms || 0}ms
                  </span>
                  {result.execution_id && (
                    <span className="meta-item">
                      ID: {result.execution_id}
                    </span>
                  )}
                </div>

                <div className="result-output">
                  <h4>Response:</h4>
                  <pre className="code-output">
                    {JSON.stringify(result.result || result, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        .tool-test-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 18px;
          color: #1a1a2e;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 28px;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: #1a1a2e;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .section-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
        }

        .input-section {
          margin-bottom: 20px;
        }

        .code-input {
          width: 100%;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-family: 'Fira Code', 'Monaco', monospace;
          font-size: 13px;
          resize: vertical;
          background: #f9fafb;
        }

        .code-input:focus {
          outline: none;
          border-color: #667eea;
          background: white;
        }

        .action-section {
          margin-bottom: 24px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-run {
          width: 100%;
          padding: 14px 20px;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-small {
          padding: 6px 12px;
          font-size: 12px;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .result-section {
          background: #f9fafb;
          border-radius: 12px;
          padding: 20px;
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-badge.success {
          background: #dcfce7;
          color: #16a34a;
        }

        .status-badge.error {
          background: #fee2e2;
          color: #dc2626;
        }

        .error-box {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .result-meta {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .meta-item {
          font-size: 13px;
          color: #6b7280;
        }

        .result-output h4 {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #374151;
        }

        .code-output {
          background: #1a1a2e;
          color: #e5e7eb;
          padding: 16px;
          border-radius: 8px;
          font-family: 'Fira Code', 'Monaco', monospace;
          font-size: 12px;
          overflow-x: auto;
          max-height: 300px;
          overflow-y: auto;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default ToolTestPanel;

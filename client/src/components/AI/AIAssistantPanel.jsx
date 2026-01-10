import React, { useState } from 'react';
import { Bot, Lightbulb, Sparkles, Search, Send, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AIAssistantPanel({ currentFlow, onApplySuggestion, onImproveFlow }) {
  const [activeTab, setActiveTab] = useState('suggest');
  const [suggestions, setSuggestions] = useState([]);
  const [improvements, setImprovements] = useState('');
  const [naturalCommand, setNaturalCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const getToken = () => localStorage.getItem('token');

  const handleSuggestNodes = async () => {
    if (!currentFlow || !currentFlow.nodes || currentFlow.nodes.length === 0) {
      setError('No flow to analyze. Add some nodes first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/ai/flow/suggest-nodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ flow: currentFlow })
      });

      const data = await res.json();

      if (data.success) {
        setSuggestions(data.suggestions || []);
      } else {
        setError(data.error || 'Failed to get suggestions');
      }
    } catch (err) {
      setError('Network error');
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleImproveFlow = async () => {
    if (!improvements.trim()) {
      setError('Please describe what improvements you want');
      return;
    }

    if (!currentFlow || !currentFlow.nodes) {
      setError('No flow to improve');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/ai/flow/improve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          flow: currentFlow,
          suggestions: improvements
        })
      });

      const data = await res.json();

      if (data.success && onImproveFlow) {
        onImproveFlow(data.flow, data.changes);
        setImprovements('');
      } else {
        setError(data.error || 'Failed to improve flow');
      }
    } catch (err) {
      setError('Network error');
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeFlow = async () => {
    if (!currentFlow || !currentFlow.nodes) {
      setError('No flow to analyze');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/ai/flow/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ flow: currentFlow })
      });

      const data = await res.json();

      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || 'Failed to analyze flow');
      }
    } catch (err) {
      setError('Network error');
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleNaturalCommand = async () => {
    if (!naturalCommand.trim()) return;

    // Process natural language command
    // This could trigger different actions based on the command
    const command = naturalCommand.toLowerCase();

    if (command.includes('suggest') || command.includes('add')) {
      handleSuggestNodes();
    } else if (command.includes('improve') || command.includes('better')) {
      setImprovements(naturalCommand);
      setActiveTab('improve');
    } else if (command.includes('analyze') || command.includes('check')) {
      handleAnalyzeFlow();
      setActiveTab('analyze');
    }

    setNaturalCommand('');
  };

  const tabs = [
    { id: 'suggest', label: 'Suggest', Icon: Lightbulb },
    { id: 'improve', label: 'Improve', Icon: Sparkles },
    { id: 'analyze', label: 'Analyze', Icon: Search }
  ];

  const priorityColors = {
    high: { bg: '#fee2e2', text: '#dc2626' },
    medium: { bg: '#fef3c7', text: '#92400e' },
    low: { bg: '#dcfce7', text: '#15803d' }
  };

  return (
    <div style={{
      width: '320px',
      backgroundColor: 'white',
      borderLeft: '1px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={20} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
            AI Assistant
          </h3>
        </div>
      </div>

      {/* Natural Language Input */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={naturalCommand}
            onChange={(e) => setNaturalCommand(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleNaturalCommand()}
            placeholder="Ask AI anything..."
            style={{
              width: '100%',
              padding: '10px 40px 10px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={handleNaturalCommand}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e5e7eb'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: activeTab === tab.id ? '#f3f4f6' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? '#1f2937' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <tab.Icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {/* Error Message */}
        {error && (
          <div style={{
            padding: '10px 12px',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {/* Suggest Tab */}
        {activeTab === 'suggest' && (
          <div>
            <button
              onClick={handleSuggestNodes}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading ? '#9ca3af' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                marginBottom: '16px',
                fontSize: '14px'
              }}
            >
              {loading ? 'Analyzing...' : 'Get Node Suggestions'}
            </button>

            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '14px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <span style={{
                        padding: '3px 8px',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {suggestion.nodeType}
                      </span>
                      <span style={{
                        padding: '3px 8px',
                        backgroundColor: priorityColors[suggestion.priority]?.bg || '#f3f4f6',
                        color: priorityColors[suggestion.priority]?.text || '#6b7280',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}>
                        {suggestion.priority}
                      </span>
                    </div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '600' }}>
                      {suggestion.title}
                    </h4>
                    <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#6b7280' }}>
                      {suggestion.description}
                    </p>
                    <button
                      onClick={() => onApplySuggestion && onApplySuggestion(suggestion)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Add This Node
                    </button>
                  </div>
                ))}
              </div>
            )}

            {suggestions.length === 0 && !loading && (
              <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
                Click the button to get AI suggestions for your flow
              </p>
            )}
          </div>
        )}

        {/* Improve Tab */}
        {activeTab === 'improve' && (
          <div>
            <textarea
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="Describe what you want to improve...&#10;&#10;Examples:&#10;- Add error handling&#10;- Make messages more friendly&#10;- Add a feedback loop"
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                resize: 'vertical',
                marginBottom: '12px',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
            <button
              onClick={handleImproveFlow}
              disabled={loading || !improvements.trim()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading || !improvements.trim() ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || !improvements.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '14px'
              }}
            >
              {loading ? 'Improving...' : 'Improve Flow'}
            </button>
          </div>
        )}

        {/* Analyze Tab */}
        {activeTab === 'analyze' && (
          <div>
            <button
              onClick={handleAnalyzeFlow}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading ? '#9ca3af' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                marginBottom: '16px',
                fontSize: '14px'
              }}
            >
              {loading ? 'Analyzing...' : 'Analyze Flow'}
            </button>

            {analysis && (
              <div>
                {/* Validation Stats */}
                <div style={{
                  padding: '14px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '10px',
                  marginBottom: '12px'
                }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '600' }}>
                    Flow Statistics
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ fontSize: '13px' }}>
                      <span style={{ color: '#6b7280' }}>Nodes: </span>
                      <span style={{ fontWeight: '500' }}>{analysis.validation?.nodeCount}</span>
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      <span style={{ color: '#6b7280' }}>Edges: </span>
                      <span style={{ fontWeight: '500' }}>{analysis.validation?.edgeCount}</span>
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      <span style={{ color: '#6b7280' }}>Variables: </span>
                      <span style={{ fontWeight: '500' }}>{analysis.validation?.variableCount}</span>
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                {analysis.suggestions?.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '600' }}>
                      Suggestions ({analysis.suggestions.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {analysis.suggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '12px',
                            backgroundColor: suggestion.type === 'error' ? '#fef2f2' :
                              suggestion.type === 'warning' ? '#fffbeb' : '#f0fdf4',
                            borderRadius: '8px',
                            borderLeft: `3px solid ${
                              suggestion.type === 'error' ? '#dc2626' :
                                suggestion.type === 'warning' ? '#f59e0b' : '#10b981'
                            }`
                          }}
                        >
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: suggestion.type === 'error' ? '#dc2626' :
                              suggestion.type === 'warning' ? '#92400e' : '#15803d',
                            marginBottom: '4px'
                          }}>
                            {suggestion.message}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {suggestion.action}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.suggestions?.length === 0 && (
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '10px',
                    textAlign: 'center'
                  }}>
                    <CheckCircle size={24} style={{ color: '#15803d' }} />
                    <p style={{ margin: '8px 0 0', color: '#15803d', fontSize: '14px' }}>
                      Flow looks good! No issues found.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
          Quick Actions
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Add welcome', 'Add FAQ', 'Add handoff', 'Add end'].map(action => (
            <button
              key={action}
              onClick={() => setNaturalCommand(action)}
              style={{
                padding: '6px 10px',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#4b5563'
              }}
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

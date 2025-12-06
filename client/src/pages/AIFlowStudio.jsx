import React, { useState, useEffect } from 'react';
import AIFlowGenerator from '../components/AI/AIFlowGenerator';
import FlowTemplateSelector from '../components/AI/FlowTemplateSelector';
import GeneratedFlowPreview from '../components/AI/GeneratedFlowPreview';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AIFlowStudio() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' or 'templates'
  const [generatedFlow, setGeneratedFlow] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showBotSelector, setShowBotSelector] = useState(false);
  const [bots, setBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(false);

  const handleFlowGenerated = (flow) => {
    setGeneratedFlow(flow);
    setShowPreview(true);
  };

  const handleTemplateSelected = (flow) => {
    setGeneratedFlow(flow);
    setShowPreview(true);
  };

  const getToken = () => localStorage.getItem('token');

  const fetchBots = async () => {
    setLoadingBots(true);
    try {
      const res = await fetch(`${API_URL}/api/bots`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBots(Array.isArray(data) ? data : data.bots || []);
      }
    } catch (err) {
      console.error('Failed to fetch bots:', err);
    } finally {
      setLoadingBots(false);
    }
  };

  const handleUseFlow = () => {
    if (generatedFlow) {
      fetchBots();
      setShowBotSelector(true);
    }
  };

  const handleSelectBot = (botId) => {
    if (generatedFlow) {
      localStorage.setItem('importedFlow', JSON.stringify(generatedFlow));
      navigate(`/bots/${botId}/flow?import=true`);
    }
  };

  const handleEditFlow = (editedFlow) => {
    setGeneratedFlow(editedFlow);
  };

  const handleBack = () => {
    setShowPreview(false);
    setGeneratedFlow(null);
  };

  const tabs = [
    { id: 'generate', label: 'AI Generate', icon: '✨' },
    { id: 'templates', label: 'Templates', icon: '📋' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ←
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '28px' }}>🤖</span>
              AI Flow Studio
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
              Create chatbot flows with AI assistance
            </p>
          </div>
        </div>

        {generatedFlow && showPreview && (
          <button
            onClick={handleUseFlow}
            style={{
              padding: '10px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>🚀</span> Open in Workflow Builder
          </button>
        )}
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        height: 'calc(100vh - 81px)'
      }}>
        {/* Left Panel - Generator/Templates */}
        <div style={{
          width: showPreview ? '400px' : '100%',
          maxWidth: showPreview ? '400px' : '800px',
          margin: showPreview ? '0' : '0 auto',
          backgroundColor: 'white',
          borderRight: showPreview ? '1px solid #e5e7eb' : 'none',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease'
        }}>
          {/* Tabs */}
          {!showPreview && (
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e5e7eb',
              padding: '0 24px'
            }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '16px 24px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: activeTab === tab.id ? '600' : '400',
                    color: activeTab === tab.id ? '#1f2937' : '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px'
          }}>
            {showPreview ? (
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>
                  Generate Another
                </h3>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
                  Not happy with the result? Generate a new flow or select a template.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    onClick={handleBack}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>✨</span> Generate New with AI
                  </button>
                  <button
                    onClick={() => { setActiveTab('templates'); handleBack(); }}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>📋</span> Browse Templates
                  </button>
                </div>

                {/* Quick Stats */}
                {generatedFlow && (
                  <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px'
                  }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600' }}>
                      Current Flow
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
                          {generatedFlow.nodes?.length || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>Nodes</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                          {generatedFlow.edges?.length || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>Connections</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {activeTab === 'generate' && (
                  <AIFlowGenerator
                    onFlowGenerated={handleFlowGenerated}
                  />
                )}
                {activeTab === 'templates' && (
                  <FlowTemplateSelector
                    onSelectTemplate={handleTemplateSelected}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Preview */}
        {showPreview && generatedFlow && (
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
            backgroundColor: '#f9fafb'
          }}>
            <GeneratedFlowPreview
              flow={generatedFlow}
              onUseFlow={handleUseFlow}
              onEdit={handleEditFlow}
            />
          </div>
        )}

        {/* Empty State when no preview */}
        {!showPreview && (
          <div style={{
            display: 'none'
          }} />
        )}
      </div>

      {/* Bot Selector Modal */}
      {showBotSelector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                Select a Bot
              </h2>
              <button
                onClick={() => setShowBotSelector(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                &times;
              </button>
            </div>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
              Choose which bot to import the flow into:
            </p>

            {loadingBots ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                Loading bots...
              </div>
            ) : bots.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                backgroundColor: '#f9fafb',
                borderRadius: '12px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                <p style={{ color: '#6b7280', marginBottom: '16px' }}>No bots found</p>
                <button
                  onClick={() => navigate('/create-bot')}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Create Your First Bot
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bots.map(bot => (
                  <button
                    key={bot.id}
                    onClick={() => handleSelectBot(bot.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.backgroundColor = '#f0f9ff';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      backgroundColor: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>
                      🤖
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '15px' }}>{bot.name}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        {bot.platform || 'telegram'} • {bot.description || 'No description'}
                      </div>
                    </div>
                    <span style={{ color: '#3b82f6', fontSize: '20px' }}>→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tips Footer */}
      {!showPreview && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTop: '1px solid #e5e7eb',
          padding: '12px 32px',
          display: 'flex',
          justifyContent: 'center',
          gap: '32px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
            <span>💡</span>
            <span>Be specific in your descriptions for better results</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
            <span>📝</span>
            <span>You can edit the generated flow before using it</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
            <span>🔄</span>
            <span>Not satisfied? Generate again with different settings</span>
          </div>
        </div>
      )}
    </div>
  );
}

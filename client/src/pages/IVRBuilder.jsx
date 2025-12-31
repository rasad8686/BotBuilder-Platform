/**
 * IVR Builder Page
 * Visual drag-and-drop builder for Interactive Voice Response systems
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const nodeTypes = {
  greeting: { icon: '👋', label: 'Greeting', color: '#4CAF50' },
  menu: { icon: '📋', label: 'Menu', color: '#2196F3' },
  input: { icon: '🔢', label: 'Input', color: '#FF9800' },
  transfer: { icon: '📞', label: 'Transfer', color: '#9C27B0' },
  voicemail: { icon: '📧', label: 'Voicemail', color: '#607D8B' },
  ai: { icon: '🤖', label: 'AI Response', color: '#00BCD4' },
  condition: { icon: '🔀', label: 'Condition', color: '#FF5722' },
  hangup: { icon: '📴', label: 'Hang Up', color: '#f44336' },
  playAudio: { icon: '🔊', label: 'Play Audio', color: '#795548' },
  recordMessage: { icon: '🎙️', label: 'Record', color: '#E91E63' }
};

const IVRBuilder = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ivrId } = useParams();
  const canvasRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ivr, setIvr] = useState({
    name: '',
    description: '',
    isActive: false,
    nodes: [],
    connections: []
  });

  const [selectedNode, setSelectedNode] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [showNodePanel, setShowNodePanel] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (ivrId && ivrId !== 'new') {
      fetchIVR();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ivrId]);

  const fetchIVR = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/voice/ivr/${ivrId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIvr(data);
      }
    } catch (err) {
      console.error('Failed to fetch IVR:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveIVR = async () => {
    setSaving(true);
    try {
      const method = ivrId && ivrId !== 'new' ? 'PUT' : 'POST';
      const url = ivrId && ivrId !== 'new' ? `/api/voice/ivr/${ivrId}` : '/api/voice/ivr';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ivr)
      });

      if (res.ok) {
        const data = await res.json();
        if (!ivrId || ivrId === 'new') {
          navigate(`/voice/ivr/${data.id}`);
        }
      }
    } catch (err) {
      console.error('Failed to save IVR:', err);
    } finally {
      setSaving(false);
    }
  };

  const addNode = (type, position) => {
    const newNode = {
      id: `node-${Date.now()}`,
      type,
      position: position || { x: 200, y: 200 },
      data: getDefaultNodeData(type)
    };

    setIvr(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));

    setSelectedNode(newNode.id);
    setShowNodePanel(false);
  };

  const getDefaultNodeData = (type) => {
    switch (type) {
      case 'greeting':
        return { message: 'Welcome to our service.', voice: 'en-US-Standard-A' };
      case 'menu':
        return { message: 'Press 1 for sales, 2 for support.', options: [{ key: '1', label: 'Sales' }, { key: '2', label: 'Support' }] };
      case 'input':
        return { message: 'Please enter your account number.', numDigits: 10, timeout: 5 };
      case 'transfer':
        return { number: '', message: 'Transferring your call.' };
      case 'voicemail':
        return { message: 'Please leave a message after the beep.', maxLength: 60 };
      case 'ai':
        return { systemPrompt: 'You are a helpful assistant.', model: 'gpt-4' };
      case 'condition':
        return { variable: '', operator: 'equals', value: '' };
      case 'hangup':
        return { message: 'Thank you for calling. Goodbye.' };
      case 'playAudio':
        return { audioUrl: '' };
      case 'recordMessage':
        return { maxLength: 120, beep: true };
      default:
        return {};
    }
  };

  const updateNode = (nodeId, updates) => {
    setIvr(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
    }));
  };

  const deleteNode = (nodeId) => {
    setIvr(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      connections: prev.connections.filter(c => c.from !== nodeId && c.to !== nodeId)
    }));
    setSelectedNode(null);
  };

  const addConnection = (fromId, toId) => {
    if (fromId === toId) return;

    const existingConnection = ivr.connections.find(
      c => c.from === fromId && c.to === toId
    );

    if (!existingConnection) {
      setIvr(prev => ({
        ...prev,
        connections: [...prev.connections, { from: fromId, to: toId, label: '' }]
      }));
    }
    setConnectingFrom(null);
  };

  const deleteConnection = (fromId, toId) => {
    setIvr(prev => ({
      ...prev,
      connections: prev.connections.filter(c => !(c.from === fromId && c.to === toId))
    }));
  };

  const handleNodeDrag = (nodeId, e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 75;
    const y = e.clientY - rect.top - 30;

    updateNode(nodeId, { position: { x: Math.max(0, x), y: Math.max(0, y) } });
  };

  const renderNodeEditor = () => {
    const node = ivr.nodes.find(n => n.id === selectedNode);
    if (!node) return null;

    const nodeType = nodeTypes[node.type];

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '24px' }}>{nodeType.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1a1a2e' }}>{nodeType.label}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6c757d' }}>Node ID: {node.id}</p>
          </div>
        </div>

        {/* Node specific editors */}
        {node.type === 'greeting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>{t('voice.message', 'Message')}</label>
              <textarea
                value={node.data.message || ''}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, message: e.target.value } })}
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('voice.voice', 'Voice')}</label>
              <select
                value={node.data.voice || ''}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, voice: e.target.value } })}
                style={inputStyle}
              >
                <option value="en-US-Standard-A">English (US) - Female</option>
                <option value="en-US-Standard-B">English (US) - Male</option>
                <option value="en-GB-Standard-A">English (UK) - Female</option>
                <option value="tr-TR-Standard-A">Turkish - Female</option>
                <option value="az-AZ-Standard-A">Azerbaijani - Female</option>
              </select>
            </div>
          </div>
        )}

        {node.type === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>{t('voice.menuPrompt', 'Menu Prompt')}</label>
              <textarea
                value={node.data.message || ''}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, message: e.target.value } })}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('voice.menuOptions', 'Menu Options')}</label>
              {(node.data.options || []).map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    placeholder="Key (1-9)"
                    value={opt.key}
                    onChange={(e) => {
                      const newOptions = [...(node.data.options || [])];
                      newOptions[idx] = { ...newOptions[idx], key: e.target.value };
                      updateNode(node.id, { data: { ...node.data, options: newOptions } });
                    }}
                    style={{ ...inputStyle, width: '80px' }}
                  />
                  <input
                    placeholder="Label"
                    value={opt.label}
                    onChange={(e) => {
                      const newOptions = [...(node.data.options || [])];
                      newOptions[idx] = { ...newOptions[idx], label: e.target.value };
                      updateNode(node.id, { data: { ...node.data, options: newOptions } });
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      const newOptions = (node.data.options || []).filter((_, i) => i !== idx);
                      updateNode(node.id, { data: { ...node.data, options: newOptions } });
                    }}
                    style={{ padding: '8px 12px', background: '#f8d7da', color: '#721c24', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [...(node.data.options || []), { key: '', label: '' }];
                  updateNode(node.id, { data: { ...node.data, options: newOptions } });
                }}
                style={{ padding: '8px 16px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
              >
                + Add Option
              </button>
            </div>
          </div>
        )}

        {node.type === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>{t('voice.inputPrompt', 'Input Prompt')}</label>
              <textarea
                value={node.data.message || ''}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, message: e.target.value } })}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('voice.numDigits', 'Number of Digits')}</label>
              <input
                type="number"
                value={node.data.numDigits || 10}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, numDigits: parseInt(e.target.value) } })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('voice.timeout', 'Timeout (seconds)')}</label>
              <input
                type="number"
                value={node.data.timeout || 5}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, timeout: parseInt(e.target.value) } })}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {node.type === 'transfer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>{t('voice.transferNumber', 'Transfer Number')}</label>
              <input
                type="tel"
                value={node.data.number || ''}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, number: e.target.value } })}
                placeholder="+1234567890"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('voice.transferMessage', 'Transfer Message')}</label>
              <textarea
                value={node.data.message || ''}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, message: e.target.value } })}
                style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
              />
            </div>
          </div>
        )}

        {node.type === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>{t('voice.aiModel', 'AI Model')}</label>
              <select
                value={node.data.model || 'gpt-4'}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, model: e.target.value } })}
                style={inputStyle}
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t('voice.systemPrompt', 'System Prompt')}</label>
              <textarea
                value={node.data.systemPrompt || ''}
                onChange={(e) => updateNode(node.id, { data: { ...node.data, systemPrompt: e.target.value } })}
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
              />
            </div>
          </div>
        )}

        {node.type === 'hangup' && (
          <div>
            <label style={labelStyle}>{t('voice.goodbyeMessage', 'Goodbye Message')}</label>
            <textarea
              value={node.data.message || ''}
              onChange={(e) => updateNode(node.id, { data: { ...node.data, message: e.target.value } })}
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            />
          </div>
        )}

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button
            onClick={() => deleteNode(node.id)}
            style={{ padding: '10px 20px', background: '#f8d7da', color: '#721c24', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
          >
            🗑️ Delete Node
          </button>
        </div>
      </div>
    );
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#495057'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box'
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e9ecef', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/voice/bots')}
            style={{ padding: '8px 16px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
          >
            ← {t('common.back', 'Back')}
          </button>
          <div>
            <input
              value={ivr.name}
              onChange={(e) => setIvr(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('voice.ivrName', 'IVR Name')}
              style={{ fontSize: '20px', fontWeight: '600', border: 'none', background: 'transparent', color: '#1a1a2e' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ivr.isActive}
              onChange={(e) => setIvr(prev => ({ ...prev, isActive: e.target.checked }))}
            />
            <span style={{ fontSize: '14px', color: '#495057' }}>{t('voice.active', 'Active')}</span>
          </label>
          <button
            onClick={saveIVR}
            disabled={saving}
            style={{
              padding: '10px 24px',
              background: saving ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        {/* Node Palette */}
        <div style={{ width: '200px', background: 'white', borderRight: '1px solid #e9ecef', padding: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a2e', marginBottom: '16px' }}>
            {t('voice.nodes', 'Nodes')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(nodeTypes).map(([type, config]) => (
              <button
                key={type}
                onClick={() => addNode(type)}
                style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#e3f2fd'}
                onMouseOut={(e) => e.target.style.background = '#f8f9fa'}
              >
                <span style={{ fontSize: '18px' }}>{config.icon}</span>
                <span style={{ fontSize: '13px', color: '#495057' }}>{config.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'auto',
            background: 'repeating-linear-gradient(0deg, transparent, transparent 20px, #f0f0f0 20px, #f0f0f0 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, #f0f0f0 20px, #f0f0f0 21px)'
          }}
        >
          {/* Connections (SVG) */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {ivr.connections.map((conn, idx) => {
              const fromNode = ivr.nodes.find(n => n.id === conn.from);
              const toNode = ivr.nodes.find(n => n.id === conn.to);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.position.x + 75;
              const y1 = fromNode.position.y + 60;
              const x2 = toNode.position.x + 75;
              const y2 = toNode.position.y;

              return (
                <g key={idx}>
                  <path
                    d={`M ${x1} ${y1} C ${x1} ${y1 + 50}, ${x2} ${y2 - 50}, ${x2} ${y2}`}
                    stroke="#667eea"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              );
            })}
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#667eea" />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {ivr.nodes.map(node => {
            const nodeType = nodeTypes[node.type];
            return (
              <div
                key={node.id}
                draggable
                onDragEnd={(e) => handleNodeDrag(node.id, e)}
                onClick={() => setSelectedNode(node.id)}
                style={{
                  position: 'absolute',
                  left: node.position.x,
                  top: node.position.y,
                  width: '150px',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: selectedNode === node.id ? `0 0 0 2px ${nodeType.color}` : '0 2px 8px rgba(0,0,0,0.1)',
                  cursor: 'move',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '8px 12px', background: nodeType.color, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{nodeType.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: '600' }}>{nodeType.label}</span>
                </div>
                <div style={{ padding: '12px', fontSize: '12px', color: '#6c757d' }}>
                  {node.data.message?.substring(0, 40) || node.data.number || 'Configure...'}
                  {node.data.message?.length > 40 && '...'}
                </div>
                {/* Connection points */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (connectingFrom && connectingFrom !== node.id) {
                      addConnection(connectingFrom, node.id);
                    } else {
                      setConnectingFrom(node.id);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '16px',
                    height: '16px',
                    background: connectingFrom === node.id ? '#667eea' : 'white',
                    border: '2px solid #667eea',
                    borderRadius: '50%',
                    cursor: 'pointer'
                  }}
                />
              </div>
            );
          })}

          {/* Empty state */}
          {ivr.nodes.length === 0 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📞</div>
              <h3 style={{ color: '#1a1a2e', marginBottom: '8px' }}>{t('voice.emptyIVR', 'Start Building Your IVR')}</h3>
              <p style={{ color: '#6c757d', marginBottom: '24px' }}>{t('voice.emptyIVRDesc', 'Click a node from the left panel to add it')}</p>
              <button
                onClick={() => addNode('greeting')}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                + {t('voice.addGreeting', 'Add Greeting Node')}
              </button>
            </div>
          )}
        </div>

        {/* Properties Panel */}
        {selectedNode && (
          <div style={{ width: '320px', background: 'white', borderLeft: '1px solid #e9ecef', overflow: 'auto' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1a1a2e' }}>{t('voice.properties', 'Properties')}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6c757d' }}
              >
                ×
              </button>
            </div>
            {renderNodeEditor()}
          </div>
        )}
      </div>
    </div>
  );
};

export default IVRBuilder;

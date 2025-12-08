import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import FlowConnector from './FlowConnector';
import VariableManager from './VariableManager';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function OrchestrationBuilderInner() {
  const { botId, orchestrationId } = useParams();
  const navigate = useNavigate();
  const [orchestration, setOrchestration] = useState(null);
  const [flows, setFlows] = useState([]);
  const [, setTransitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showFlowSelector, setShowFlowSelector] = useState(false);
  const [showConnectorModal, setShowConnectorModal] = useState(false);
  const [showVariableManager, setShowVariableManager] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orchestrationId, botId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [orchRes, flowsRes, transitionsRes] = await Promise.all([
        fetch(`${API_URL}/api/orchestrations/${orchestrationId}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch(`${API_URL}/api/bots/${botId}/flow`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch(`${API_URL}/api/orchestrations/${orchestrationId}/transitions`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
      ]);

      let entryFlowId = null;
      if (orchRes.ok) {
        const orchData = await orchRes.json();
        setOrchestration(orchData.data);
        entryFlowId = orchData.data?.entry_flow_id;
      }

      if (flowsRes.ok) {
        const flowsData = await flowsRes.json();
        const flowList = flowsData.data ? [flowsData.data] : [];
        setFlows(flowList);
        buildNodesFromFlows(flowList, entryFlowId);
      }

      if (transitionsRes.ok) {
        const transData = await transitionsRes.json();
        setTransitions(transData.data || []);
        buildEdgesFromTransitions(transData.data || []);
      }
    } catch (error) {
      // Error fetching data
    } finally {
      setLoading(false);
    }
  };

  const buildNodesFromFlows = (flowList, entryFlowId = null) => {
    const newNodes = flowList.map((flow, index) => {
      const isEntryFlow = entryFlowId && flow.id === entryFlowId;
      return {
        id: `flow-${flow.id}`,
        type: 'default',
        position: { x: 100 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 200 },
        data: {
          flowId: flow.id,
          flowName: flow.name || `Flow ${flow.id}`,
          label: (
            <div style={{ padding: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{isEntryFlow ? '🚀' : '📋'}</div>
              <div style={{ fontWeight: 600 }}>{flow.name || `Flow ${flow.id}`}</div>
              <div style={{ fontSize: 11, color: isEntryFlow ? '#059669' : '#6b7280' }}>
                {isEntryFlow ? '✓ Entry Flow' : `${flow.flow_data?.nodes?.length || 0} nodes`}
              </div>
            </div>
          )
        },
        style: {
          backgroundColor: isEntryFlow ? '#d1fae5' : '#f3e8ff',
          border: isEntryFlow ? '3px solid #10b981' : '2px solid #8b5cf6',
          borderRadius: 12,
          minWidth: 150,
          cursor: 'pointer'
        }
      };
    });
    setNodes(newNodes);
  };

  const buildEdgesFromTransitions = (transitionList) => {
    const newEdges = transitionList.map(t => ({
      id: `edge-${t.id}`,
      source: `flow-${t.from_flow_id}`,
      target: `flow-${t.to_flow_id}`,
      label: t.trigger_type,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#8b5cf6' },
      labelStyle: { fill: '#6b7280', fontSize: 11 },
      data: { transition: t }
    }));
    setEdges(newEdges);
  };

  const onConnect = useCallback((params) => {
    setSelectedConnection(params);
    setShowConnectorModal(true);
  }, []);

  const handleTransitionCreate = async (transitionData) => {
    try {
      const fromFlowId = selectedConnection.source.replace('flow-', '');
      const toFlowId = selectedConnection.target.replace('flow-', '');

      const res = await fetch(`${API_URL}/api/orchestrations/${orchestrationId}/transitions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from_flow_id: fromFlowId,
          to_flow_id: toFlowId,
          trigger_type: transitionData.trigger_type,
          trigger_value: transitionData.trigger_value,
          priority: transitionData.priority || 0
        })
      });

      if (res.ok) {
        showNotification('Transition created successfully', 'success');
        fetchData();
      }
    } catch (error) {
      showNotification('Failed to create transition', 'error');
    }
    setShowConnectorModal(false);
    setSelectedConnection(null);
  };

  const handleDeleteTransition = async (transitionId) => {
    try {
      const res = await fetch(`${API_URL}/api/orchestrations/${orchestrationId}/transitions/${transitionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        showNotification('Transition deleted', 'success');
        fetchData();
      }
    } catch (error) {
      // Error deleting transition
    }
  };

  const handleSetEntryFlow = async (flowId) => {
    try {
      const res = await fetch(`${API_URL}/api/orchestrations/${orchestrationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entry_flow_id: flowId })
      });
      if (res.ok) {
        showNotification('Entry flow updated', 'success');
        fetchData();
      }
    } catch (error) {
      // Error setting entry flow
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRunWorkflow = async () => {
    if (!orchestration?.entry_flow_id) {
      showNotification('Please set an entry flow first', 'error');
      return;
    }

    try {
      setIsRunning(true);
      const sessionId = `session_${Date.now()}`;

      const res = await fetch(`${API_URL}/api/orchestrations/${orchestrationId}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          input: {}
        })
      });

      if (res.ok) {
        await res.json();
        showNotification('Workflow started successfully!', 'success');
        // Navigate to executions page after short delay
        setTimeout(() => {
          navigate(`/bots/${botId}/executions`);
        }, 1000);
      } else {
        const error = await res.json();
        showNotification(error.error || 'Failed to start workflow', 'error');
      }
    } catch (error) {
      showNotification('Failed to start workflow', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const onEdgeClick = useCallback((event, edge) => {
    if (window.confirm('Delete this transition?')) {
      const transitionId = edge.id.replace('edge-', '');
      handleDeleteTransition(transitionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodeClick = useCallback((event, node) => {
    const flowId = node.data?.flowId;
    const flowName = node.data?.flowName;
    if (flowId) {
      setSelectedNode({ flowId, flowName, x: event.clientX, y: event.clientY });
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6b7280' }}>Loading orchestration builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate(`/bots/${botId}/orchestrations`)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}
          >
            ←
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔀</span>
              {orchestration?.name || 'Orchestration Builder'}
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Connect flows to create conversation journeys
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowVariableManager(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>📊</span> Variables
          </button>
          <button
            onClick={handleRunWorkflow}
            disabled={isRunning}
            style={{
              padding: '10px 20px',
              backgroundColor: isRunning ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>{isRunning ? '⏳' : '▶'}</span> {isRunning ? 'Running...' : 'Run Workflow'}
          </button>
          <button
            onClick={() => setShowFlowSelector(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>+</span> Add Flow
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: 80,
          right: 24,
          padding: '12px 24px',
          borderRadius: 8,
          backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          fontWeight: 500,
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {notification.message}
        </div>
      )}

      {/* Node Context Menu */}
      {selectedNode && (
        <div style={{
          position: 'fixed',
          top: selectedNode.y,
          left: selectedNode.x,
          backgroundColor: 'white',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          minWidth: 180,
          overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>
            {selectedNode.flowName}
          </div>
          <button
            onClick={() => {
              handleSetEntryFlow(selectedNode.flowId);
              setSelectedNode(null);
            }}
            disabled={orchestration?.entry_flow_id === selectedNode.flowId}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: orchestration?.entry_flow_id === selectedNode.flowId ? '#f3f4f6' : 'white',
              border: 'none',
              textAlign: 'left',
              cursor: orchestration?.entry_flow_id === selectedNode.flowId ? 'default' : 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: orchestration?.entry_flow_id === selectedNode.flowId ? '#9ca3af' : '#374151'
            }}
            onMouseEnter={(e) => {
              if (orchestration?.entry_flow_id !== selectedNode.flowId) {
                e.target.style.backgroundColor = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (orchestration?.entry_flow_id !== selectedNode.flowId) {
                e.target.style.backgroundColor = 'white';
              }
            }}
          >
            <span>🚀</span>
            {orchestration?.entry_flow_id === selectedNode.flowId ? '✓ Current Entry Flow' : 'Set as Entry Flow'}
          </button>
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
          <Controls />
          <MiniMap
            nodeColor={() => '#8b5cf6'}
            style={{ backgroundColor: '#f9fafb' }}
          />
        </ReactFlow>
      </div>

      {/* Info Panel */}
      <div style={{
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: 24, fontSize: 14, color: '#6b7280' }}>
          <span><strong>{nodes.length}</strong> Flows</span>
          <span><strong>{edges.length}</strong> Transitions</span>
          <span>Entry Flow: <strong>{orchestration?.entry_flow_id ? `Flow #${orchestration.entry_flow_id}` : 'Not Set'}</strong></span>
        </div>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          Click node to set entry flow • Drag between nodes to create transitions • Click edges to delete
        </div>
      </div>

      {/* Flow Connector Modal */}
      {showConnectorModal && (
        <FlowConnector
          onClose={() => { setShowConnectorModal(false); setSelectedConnection(null); }}
          onSave={handleTransitionCreate}
        />
      )}

      {/* Variable Manager Modal */}
      {showVariableManager && (
        <VariableManager
          orchestrationId={orchestrationId}
          onClose={() => setShowVariableManager(false)}
        />
      )}

      {/* Flow Selector Modal */}
      {showFlowSelector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 32,
            width: '100%',
            maxWidth: 500
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Add Flow to Orchestration</h2>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>
              Select a flow to add to this orchestration. You can then connect it with other flows.
            </p>
            {flows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
                <p>No flows available. Create flows first.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {flows.map(flow => (
                  <div
                    key={flow.id}
                    style={{
                      padding: 16,
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{flow.name || `Flow ${flow.id}`}</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        {flow.flow_data?.nodes?.length || 0} nodes
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleSetEntryFlow(flow.id);
                        setShowFlowSelector(false);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#8b5cf6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13
                      }}
                    >
                      Set as Entry
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={() => setShowFlowSelector(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function OrchestrationBuilder() {
  return (
    <ReactFlowProvider>
      <OrchestrationBuilderInner />
    </ReactFlowProvider>
  );
}

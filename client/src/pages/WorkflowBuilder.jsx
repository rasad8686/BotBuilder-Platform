import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import {
  WorkflowCanvas,
  WorkflowSidebar,
  WorkflowToolbar,
  WorkflowConfigPanel
} from '../components/workflow';
import { ExecutionMonitor } from '../components/execution';
import { DebugPanel } from '../components/debug';

const initialNodes = [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 250, y: 50 },
    data: { label: 'Start' }
  }
];

// Wrapper component to use useReactFlow hook inside ReactFlowProvider
const WorkflowToolbarWrapper = (props) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <WorkflowToolbar
      {...props}
      onZoomIn={() => zoomIn()}
      onZoomOut={() => zoomOut()}
      onFitView={() => fitView()}
    />
  );
};

const WorkflowBuilder = () => {
  const { t } = useTranslation();
  const { botId, workflowId } = useParams();
  const navigate = useNavigate();

  const [bot, setBot] = useState(null);
  const [agents, setAgents] = useState([]);
  const [, setWorkflow] = useState(null);
  const [workflowName, setWorkflowName] = useState('New Workflow');

  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning] = useState(false);
  const [, setError] = useState(null);

  const [showExecutionMonitor, setShowExecutionMonitor] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [, setHighlightedNodeId] = useState(null);

  // Debug panel execution state - updated from ExecutionMonitor
  const [debugExecutionState, setDebugExecutionState] = useState(null);
  const [debugIsRunning, setDebugIsRunning] = useState(false);

  // Callback to receive execution updates from ExecutionMonitor
  const handleExecutionUpdate = useCallback((data) => {
    if (!data) return;

    const { status, currentStep, steps, messages, error } = data;

    setDebugIsRunning(status === 'running');

    if (!steps || steps.length === 0) {
      setDebugExecutionState(null);
      return;
    }

    // Build execution path from steps
    const path = steps.map((step, index) => ({
      nodeId: step.agentName || step.id || `step-${index}`,
      timestamp: step.startTime,
      order: index
    }));

    // Build node outputs
    const outputs = {};
    steps.forEach(step => {
      const nodeId = step.agentName || step.id;
      outputs[nodeId] = {
        input: step.input || null,
        output: step.output || null,
        duration: step.duration || null,
        status: step.status || 'pending'
      };
    });

    // Build variables from outputs
    const variables = {};
    steps.forEach(step => {
      const nodeId = step.agentName || step.id;
      if (step.output) {
        variables[`$${nodeId}.output`] = step.output;
      }
      if (step.input) {
        variables[`$${nodeId}.input`] = step.input;
      }
    });

    // Build errors
    const errors = steps
      .filter(step => step.status === 'failed')
      .map(step => ({
        message: step.error || 'Step failed',
        nodeId: step.agentName || step.id,
        timestamp: step.startTime,
        type: 'error'
      }));

    if (error) {
      errors.push({
        message: error,
        timestamp: new Date().toISOString(),
        type: 'error'
      });
    }

    setDebugExecutionState({
      currentNodeId: currentStep?.agentName || currentStep?.id || null,
      path,
      outputs,
      variables,
      errors,
      warnings: [],
      logs: (messages || []).map(msg => ({
        message: msg.content,
        nodeId: msg.fromAgent,
        timestamp: msg.timestamp,
        type: 'log'
      }))
    });
  }, []);

  // Ref for WorkflowCanvas to access undo/redo
  const canvasRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Bot selector state
  const [bots, setBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (botId) {
      fetchData();
    } else {
      setIsLoading(false);
      fetchBots();
    }
  }, [botId, workflowId]);

  const fetchBots = async () => {
    try {
      setLoadingBots(true);
      const res = await fetch('/api/bots', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBots(Array.isArray(data) ? data : data.bots || []);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoadingBots(false);
    }
  };

  const fetchData = async () => {
    // Skip if no botId
    if (!botId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch bot info
      const botRes = await fetch(`/api/bots/${botId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (botRes.ok) {
        const botData = await botRes.json();
        setBot(botData);
      }

      // Fetch agents
      const agentsRes = await fetch(`/api/agents/bot/${botId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData);
      }

      // Fetch workflow if editing existing
      if (workflowId) {
        const workflowRes = await fetch(`/api/workflows/${workflowId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (workflowRes.ok) {
          const workflowData = await workflowRes.json();
          setWorkflow(workflowData);
          setWorkflowName(workflowData.name);

          // Load nodes and edges from flow_config
          if (workflowData.flow_config?.nodes) {
            setNodes(workflowData.flow_config.nodes);
          }
          if (workflowData.flow_config?.edges) {
            setEdges(workflowData.flow_config.edges);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Update undo/redo state from canvas ref
  useEffect(() => {
    const interval = setInterval(() => {
      if (canvasRef.current) {
        setCanUndo(canvasRef.current.canUndo);
        setCanRedo(canvasRef.current.canRedo);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleNodesChange = useCallback(() => {
    // changes is ReactFlow changes array, not nodes - just ignore it here
    // WorkflowCanvas handles internal state with useNodesState
  }, []);

  const handleEdgesChange = useCallback(() => {
    // changes is ReactFlow changes array, not edges - just ignore it here
    // WorkflowCanvas handles internal state with useEdgesState
  }, []);

  const handleConnect = useCallback(() => {
    // Handled by WorkflowCanvas
  }, []);

  // Save state after significant changes (called from WorkflowCanvas)
  const handleStateChange = useCallback(() => {
    // State is now managed in WorkflowCanvas
  }, []);

  const handleNodeClick = useCallback((_event, node) => {
    setSelectedNode(node);
  }, []);

  // Drop is now handled in WorkflowCanvas
  const handleDrop = useCallback(() => {
    // Drop logic moved to WorkflowCanvas
  }, []);

  const handleNodeUpdate = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const flowConfig = { nodes, edges };
      const agentsConfig = nodes
        .filter((n) => n.type === 'agent' && n.data.agentId)
        .map((n, i) => ({
          agentId: n.data.agentId,
          order: i
        }));

      const payload = {
        bot_id: parseInt(botId),
        name: workflowName,
        workflow_type: detectWorkflowType(),
        agents_config: agentsConfig,
        flow_config: flowConfig
      };

      const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows';
      const method = workflowId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to save workflow');
      }

      const saved = await res.json();
      if (!workflowId) {
        navigate(`/bots/${botId}/workflows/${saved.id}`, { replace: true });
      }

      alert('Workflow saved successfully!');
    } catch (err) {
      alert('Error saving workflow: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const detectWorkflowType = () => {
    const hasParallel = nodes.some((n) => n.type === 'parallel');
    const hasCondition = nodes.some((n) => n.type === 'condition');

    if (hasParallel && hasCondition) return 'mixed';
    if (hasParallel) return 'parallel';
    if (hasCondition) return 'conditional';
    return 'sequential';
  };

  const handleRun = () => {
    if (!workflowId) {
      alert('Please save the workflow first');
      return;
    }
    setShowExecutionMonitor(true);
  };

  const handleToggleDebug = useCallback(() => {
    setShowDebugPanel(prev => !prev);
  }, []);

  const handleNodeHighlight = useCallback((nodeId) => {
    setHighlightedNodeId(nodeId);
  }, []);

  const handleClear = () => {
    if (window.confirm('Clear all nodes? This cannot be undone.')) {
      setNodes(initialNodes);
      setEdges([]);
      setSelectedNode(null);
    }
  };

  const handleUndo = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.undo();
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.redo();
    }
  }, []);

  // If no botId, show bot selector
  if (!botId) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>🔄</span>
              {t('workflows.title')}
            </h1>
            <p style={{ color: '#6c757d', margin: 0 }}>
              {t('workflows.subtitle')}
            </p>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e', marginTop: 0, marginBottom: '16px' }}>
              {t('common.selectBot')}
            </h2>
            <p style={{ color: '#6c757d', marginBottom: '24px' }}>
              {t('common.selectBotDesc')}
            </p>
            {loadingBots ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                {t('common.loading')}
              </div>
            ) : bots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                <p style={{ color: '#6c757d', marginBottom: '16px' }}>{t('agentStudio.noBotsFound')}</p>
                <button
                  type="button"
                  onClick={() => navigate('/create-bot')}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {t('agentStudio.createFirstBot')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {bots.map(bot => (
                  <button
                    key={bot.id}
                    type="button"
                    onClick={() => navigate(`/bots/${bot.id}/workflows`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      width: '100%'
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>🤖</span>
                    <div>
                      <div style={{ color: '#1a1a2e', fontWeight: '600', fontSize: '14px' }}>{bot.name}</div>
                      <div style={{ color: '#6c757d', fontSize: '12px', marginTop: '2px' }}>{bot.description || 'Bot'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="workflow-builder loading">
        <div className="spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="workflow-builder">
        <div className="builder-header">
          <Link to={`/bots/${botId}/agents`} className="back-link">
            ← Back to Agent Studio
          </Link>
          {bot && <span className="bot-name">{bot.name}</span>}
        </div>

        <WorkflowToolbarWrapper
          workflowName={workflowName}
          onNameChange={setWorkflowName}
          onSave={handleSave}
          onRun={handleRun}
          onClear={handleClear}
          onUndo={handleUndo}
          onRedo={handleRedo}
          isSaving={isSaving}
          isRunning={isRunning}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Debug Toggle Button */}
        <button
          onClick={handleToggleDebug}
          style={{
            position: 'fixed',
            right: showDebugPanel ? '395px' : '20px',
            bottom: '20px',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: showDebugPanel ? '#667eea' : '#1a1a2e',
            color: '#e4e4e7',
            border: '1px solid #2d2d44',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease'
          }}
        >
          <span>🐛</span>
          {showDebugPanel ? 'Hide Debug' : 'Debug'}
        </button>

        <div className="builder-content">
          <WorkflowSidebar agents={agents} />

          <div className="canvas-container">
            <WorkflowCanvas
              ref={canvasRef}
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onDrop={handleDrop}
              onStateChange={handleStateChange}
            />
          </div>

          <WorkflowConfigPanel
            node={selectedNode}
            agents={agents}
            onUpdate={handleNodeUpdate}
            onClose={() => setSelectedNode(null)}
          />

          {/* Debug Panel */}
          {showDebugPanel && (
            <DebugPanel
              nodes={nodes}
              edges={edges}
              isRunning={debugIsRunning}
              executionState={debugExecutionState}
              onNodeHighlight={handleNodeHighlight}
              onClose={() => setShowDebugPanel(false)}
            />
          )}
        </div>

        {showExecutionMonitor && (
          <div className="execution-monitor-overlay">
            <div className="execution-monitor-modal">
              <ExecutionMonitor
                workflowId={workflowId}
                onClose={() => setShowExecutionMonitor(false)}
                onExecutionUpdate={handleExecutionUpdate}
              />
            </div>
          </div>
        )}
      </div>

      <style>{`
        .workflow-builder {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f7fa;
        }

        .workflow-builder.loading {
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e9ecef;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .builder-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 20px;
          background: white;
          border-bottom: 1px solid #e9ecef;
        }

        .back-link {
          color: #667eea;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        .bot-name {
          color: #6c757d;
          font-size: 14px;
        }

        .builder-content {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
          height: 100%;
        }

        .canvas-container {
          flex: 1;
          height: 100%;
          min-height: 500px;
          min-width: 0;
          position: relative;
          overflow: hidden;
        }

        .execution-monitor-overlay {
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
        }

        .execution-monitor-modal {
          width: 90%;
          max-width: 1400px;
          height: 85vh;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </ReactFlowProvider>
  );
};

export default WorkflowBuilder;

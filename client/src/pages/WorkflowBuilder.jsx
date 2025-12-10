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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-4 sm:p-8 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2 sm:gap-3">
              <span className="text-3xl sm:text-4xl">🔄</span>
              {t('workflows.title')}
            </h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
              {t('workflows.subtitle')}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg transition-colors duration-300">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-0 mb-4">
              {t('common.selectBot')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {t('common.selectBotDesc')}
            </p>
            {loadingBots ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {t('common.loading')}
              </div>
            ) : bots.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🤖</div>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{t('agentStudio.noBotsFound')}</p>
                <button
                  type="button"
                  onClick={() => navigate('/create-bot')}
                  className="px-5 py-2.5 bg-indigo-500 text-white border-none rounded-lg cursor-pointer font-medium hover:bg-indigo-600 transition-colors"
                >
                  {t('agentStudio.createFirstBot')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bots.map(bot => (
                  <button
                    key={bot.id}
                    type="button"
                    onClick={() => navigate(`/bots/${bot.id}/workflows`)}
                    className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl cursor-pointer text-left transition-all w-full hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-600"
                  >
                    <span className="text-2xl">🤖</span>
                    <div>
                      <div className="text-gray-900 dark:text-white font-semibold text-sm">{bot.name}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{bot.description || 'Bot'}</div>
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

        .dark .workflow-builder {
          background: #0f172a;
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

        .dark .spinner {
          border-color: #334155;
          border-top-color: #667eea;
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

        .dark .builder-header {
          background: #1e293b;
          border-bottom-color: #334155;
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

        .dark .bot-name {
          color: #94a3b8;
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

        .dark .execution-monitor-modal {
          background: #1e293b;
        }
      `}</style>
    </ReactFlowProvider>
  );
};

export default WorkflowBuilder;

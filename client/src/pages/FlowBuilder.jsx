import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';

import useFlowStore from '../store/flowStore';
import flowsApi from '../api/flows';

// Import nodeTypes from separate module for stable reference
import { nodeTypes } from '../components/nodes';

// Import UI components
import FlowToolbox from '../components/FlowToolbox';
import NodeEditor from '../components/NodeEditor';


function FlowBuilder() {
  const { t } = useTranslation();
  const { botId } = useParams();
  const navigate = useNavigate();

  // Use ref for nodeTypes to ensure stable reference across renders
  const nodeTypesRef = useRef(nodeTypes);

  // Zustand store state
  const {
    nodes,
    edges,
    selectedNode,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNode,
    deleteNode,
    selectNode,
    clearSelection,
    clearFlow,
    loadFlow,
    getFlowData,
    markAsUnmodified,
    isModified
  } = useFlowStore();

  // Local component state
  const [currentFlowId, setCurrentFlowId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Fetch flow data on mount
  useEffect(() => {
    const fetchFlow = async () => {
      try {
        setIsLoading(true);

        // Fetch active flow if exists
        try {
          const flowResponse = await flowsApi.getFlow(botId);
          if (flowResponse.success && flowResponse.data) {
            setCurrentFlowId(flowResponse.data.id);
            loadFlow(flowResponse.data.flow_data);
            showNotification(t('flowBuilder.flowLoaded'), 'success');
          }
        } catch {
          // No flow exists yet - that's okay
          // No existing flow found - starting fresh
        }
      } catch (error) {
        // Silent fail
        showNotification(t('flowBuilder.loadError'), 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, loadFlow]);

  // Set up onEdit callback for nodes
  useEffect(() => {
    nodes.forEach((node) => {
      if (node.data && !node.data.onEdit) {
        node.data.onEdit = (nodeId) => {
          selectNode(nodeId);
          setIsEditorOpen(true);
        };
      }
    });
  }, [nodes, selectNode]);

  // Add node to canvas
  const handleAddNode = useCallback((nodeType) => {
    const position = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100
    };
    addNode(nodeType, position);
    showNotification(`${nodeType} ${t('flowBuilder.nodeAdded')}`, 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addNode]);

  // Save flow to backend
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const flowData = getFlowData();

      // Validate flow has at least one node
      if (flowData.nodes.length === 0) {
        showNotification(t('flowBuilder.emptyFlowError'), 'error');
        return;
      }

      let response;
      if (currentFlowId) {
        // Update existing flow (creates new version)
        response = await flowsApi.updateFlow(botId, currentFlowId, flowData);
        showNotification(t('flowBuilder.flowUpdated'), 'success');
      } else {
        // Create new flow
        response = await flowsApi.saveFlow(botId, flowData);
        showNotification(t('flowBuilder.flowSaved'), 'success');
      }

      if (response.success && response.data) {
        setCurrentFlowId(response.data.id);
        markAsUnmodified();
      }
    } catch (error) {
      // Silent fail
      showNotification(error.response?.data?.message || t('flowBuilder.saveError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Export flow as JSON
  const handleExport = () => {
    const flowData = getFlowData();
    const dataStr = JSON.stringify(flowData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bot-${botId}-flow-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification(t('flowBuilder.flowExported'), 'success');
  };

  // Clear canvas
  const handleClear = () => {
    if (window.confirm(t('flowBuilder.clearConfirm'))) {
      clearFlow();
      showNotification(t('flowBuilder.canvasCleared'), 'info');
    }
  };

  // Handle node editor save
  const handleEditorSave = (nodeId, newData) => {
    updateNode(nodeId, newData);
    showNotification(t('flowBuilder.nodeUpdated'), 'success');
  };

  // Handle node deletion (on Delete key press)
  const handleNodesDelete = useCallback((nodesToDelete) => {
    nodesToDelete.forEach((node) => {
      deleteNode(node.id);
    });
    showNotification(`${nodesToDelete.length} ${t('flowBuilder.nodesDeleted')}`, 'info');
  }, [deleteNode, t]);

  // Show notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">{t('flowBuilder.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/my-bots')}
            className="text-gray-600 hover:text-gray-800 transition"
          >
            ← {t('flowBuilder.backToBots')}
          </button>
          <div className="border-l border-gray-300 pl-4">
            <h1 className="text-2xl font-bold text-gray-800">{t('flowBuilder.botTitle')} #{botId}</h1>
            <p className="text-sm text-gray-600">{t('flowBuilder.title')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isModified && (
            <span className="text-sm text-orange-600 font-medium">● {t('flowBuilder.unsavedChanges')}</span>
          )}
          <span className="text-sm text-gray-600">
            {nodes.length} {t('flowBuilder.nodes')} | {edges.length} {t('flowBuilder.connections')}
          </span>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-20 right-6 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium animate-slide-in ${
          notification.type === 'success' ? 'bg-green-500' :
          notification.type === 'error' ? 'bg-red-500' :
          'bg-blue-500'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Toolbox Sidebar */}
        <div className="w-72 flex-shrink-0">
          <FlowToolbox
            onAddNode={handleAddNode}
            onSave={handleSave}
            onClear={handleClear}
            onExport={handleExport}
            isSaving={isSaving}
          />
        </div>

        {/* ReactFlow Canvas */}
        <div className="flex-1 relative" style={{ width: '100%', height: '100%', minHeight: '500px' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={handleNodesDelete}
            nodeTypes={nodeTypesRef.current}
            fitView
            attributionPosition="bottom-left"
            className="bg-gray-50"
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#CBD5E1"
            />
            <Controls
              className="bg-white border border-gray-300 rounded-lg shadow-md"
            />
            <MiniMap
              className="bg-white border border-gray-300 rounded-lg shadow-md"
              nodeColor={(node) => {
                switch (node.type) {
                  case 'start': return '#10B981';
                  case 'text': return '#3B82F6';
                  case 'question': return '#8B5CF6';
                  case 'condition': return '#F59E0B';
                  case 'end': return '#EF4444';
                  default: return '#6B7280';
                }
              }}
            />
          </ReactFlow>

          {/* Empty State */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-white p-8 rounded-xl shadow-lg border-2 border-dashed border-gray-300">
                <div className="text-6xl mb-4">🤖</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('flowBuilder.emptyState.title')}</h2>
                <p className="text-gray-600 mb-4">{t('flowBuilder.emptyState.description')}</p>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>💡 {t('flowBuilder.emptyState.tip1')}</p>
                  <p>💡 {t('flowBuilder.emptyState.tip2')}</p>
                  <p>💡 {t('flowBuilder.emptyState.tip3')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Node Editor Modal */}
      <NodeEditor
        node={selectedNode}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          clearSelection();
        }}
        onSave={handleEditorSave}
      />
    </div>
  );
}

// Wrap with ReactFlowProvider to fix nodeTypes warning
function FlowBuilderWithProvider() {
  return (
    <ReactFlowProvider>
      <FlowBuilder />
    </ReactFlowProvider>
  );
}

export default FlowBuilderWithProvider;

import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';

import useFlowStore from '../store/flowStore';
import flowsApi from '../api/flows';
import botsApi from '../api/bots';

// Import custom node components
import StartNode from '../components/nodes/StartNode';
import TextNode from '../components/nodes/TextNode';
import QuestionNode from '../components/nodes/QuestionNode';
import ConditionNode from '../components/nodes/ConditionNode';
import EndNode from '../components/nodes/EndNode';

// Import UI components
import FlowToolbox from '../components/FlowToolbox';
import NodeEditor from '../components/NodeEditor';

// Define custom node types for ReactFlow
const nodeTypes = {
  start: StartNode,
  text: TextNode,
  question: QuestionNode,
  condition: ConditionNode,
  end: EndNode
};

function FlowBuilder() {
  const { botId } = useParams();
  const navigate = useNavigate();

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
  const [botName, setBotName] = useState('');
  const [currentFlowId, setCurrentFlowId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Fetch bot details and flow data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch bot details
        const botResponse = await botsApi.getBotById(botId);
        if (botResponse.success) {
          setBotName(botResponse.data.name);
        }

        // Fetch active flow if exists
        try {
          const flowResponse = await flowsApi.getFlow(botId);
          if (flowResponse.success && flowResponse.data) {
            setCurrentFlowId(flowResponse.data.id);
            loadFlow(flowResponse.data.flow_data);
            showNotification('Flow loaded successfully', 'success');
          }
        } catch (flowError) {
          // No flow exists yet - that's okay
          console.log('No existing flow found - starting fresh');
        }
      } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Error loading flow builder', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
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
    showNotification(`${nodeType} node added`, 'success');
  }, [addNode]);

  // Save flow to backend
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const flowData = getFlowData();

      // Validate flow has at least one node
      if (flowData.nodes.length === 0) {
        showNotification('Cannot save empty flow', 'error');
        return;
      }

      let response;
      if (currentFlowId) {
        // Update existing flow (creates new version)
        response = await flowsApi.updateFlow(botId, currentFlowId, flowData);
        showNotification('Flow updated successfully (new version created)', 'success');
      } else {
        // Create new flow
        response = await flowsApi.saveFlow(botId, flowData);
        showNotification('Flow saved successfully', 'success');
      }

      if (response.success && response.data) {
        setCurrentFlowId(response.data.id);
        markAsUnmodified();
      }
    } catch (error) {
      console.error('Error saving flow:', error);
      showNotification(error.response?.data?.message || 'Error saving flow', 'error');
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
    link.download = `${botName}-flow-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('Flow exported successfully', 'success');
  };

  // Clear canvas
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the entire canvas? This cannot be undone.')) {
      clearFlow();
      showNotification('Canvas cleared', 'info');
    }
  };

  // Handle node editor save
  const handleEditorSave = (nodeId, newData) => {
    updateNode(nodeId, newData);
    showNotification('Node updated', 'success');
  };

  // Handle node deletion (on Delete key press)
  const handleNodesDelete = useCallback((nodesToDelete) => {
    nodesToDelete.forEach((node) => {
      deleteNode(node.id);
    });
    showNotification(`${nodesToDelete.length} node(s) deleted`, 'info');
  }, [deleteNode]);

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
          <p className="text-gray-600 font-medium">Loading Flow Builder...</p>
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
            ← Back to Bots
          </button>
          <div className="border-l border-gray-300 pl-4">
            <h1 className="text-2xl font-bold text-gray-800">{botName}</h1>
            <p className="text-sm text-gray-600">Visual Flow Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isModified && (
            <span className="text-sm text-orange-600 font-medium">● Unsaved changes</span>
          )}
          <span className="text-sm text-gray-600">
            {nodes.length} node(s) | {edges.length} connection(s)
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
      <div className="flex flex-1 overflow-hidden">
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
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={handleNodesDelete}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            className="bg-gray-50"
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
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Start Building Your Flow</h2>
                <p className="text-gray-600 mb-4">Click on nodes in the toolbox to add them to the canvas</p>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>💡 Tip: Drag from node handles to create connections</p>
                  <p>💡 Tip: Select and press Delete to remove nodes</p>
                  <p>💡 Tip: Use scroll wheel to zoom in/out</p>
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

export default FlowBuilder;

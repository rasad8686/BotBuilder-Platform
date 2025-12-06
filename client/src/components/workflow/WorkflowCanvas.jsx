import React, { useCallback, useRef, useMemo, useState, useEffect, useImperativeHandle, forwardRef, useLayoutEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes as importedNodeTypes } from './nodes';

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#667eea', strokeWidth: 2 }
};

const WorkflowCanvas = forwardRef(({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: onNodesChangeExternal,
  onEdgesChange: onEdgesChangeExternal,
  onConnect: onConnectExternal,
  onNodeClick,
  onDrop,
  onDragOver,
  onStateChange
}, ref) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
  const { screenToFlowPosition } = useReactFlow();

  // Wait for container to mount and have dimensions before rendering ReactFlow
  const [isMounted, setIsMounted] = useState(false);
  useLayoutEffect(() => {
    // Use setTimeout to ensure DOM is fully painted
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // History state for undo/redo
  const [history, setHistory] = useState([{ nodes: initialNodes || [], edges: initialEdges || [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoAction = useRef(false);

  // Memoize nodeTypes to prevent re-renders
  const nodeTypes = useMemo(() => importedNodeTypes, []);

  // Save current state to history
  const saveToHistory = useCallback((newNodes, newEdges) => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ nodes: newNodes, edges: newEdges });
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setNodes(history[newIndex].nodes);
      setEdges(history[newIndex].edges);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setNodes(history[newIndex].nodes);
      setEdges(history[newIndex].edges);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  // Expose undo/redo to parent
  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    redo: handleRedo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  }), [handleUndo, handleRedo, historyIndex, history.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
        event.preventDefault();
        handleRedo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    if (onNodesChangeExternal) {
      onNodesChangeExternal(changes);
    }
    // Save to history on node remove
    const hasRemove = changes.some(c => c.type === 'remove');
    if (hasRemove) {
      setTimeout(() => {
        setNodes(currentNodes => {
          setEdges(currentEdges => {
            saveToHistory(currentNodes, currentEdges);
            if (onStateChange) {
              onStateChange(currentNodes, currentEdges);
            }
            return currentEdges;
          });
          return currentNodes;
        });
      }, 0);
    }
  }, [onNodesChange, onNodesChangeExternal, onStateChange, setNodes, setEdges, saveToHistory]);

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    if (onEdgesChangeExternal) {
      onEdgesChangeExternal(changes);
    }
    // Save to history on edge remove
    const hasRemove = changes.some(c => c.type === 'remove');
    if (hasRemove) {
      setTimeout(() => {
        setNodes(currentNodes => {
          setEdges(currentEdges => {
            saveToHistory(currentNodes, currentEdges);
            if (onStateChange) {
              onStateChange(currentNodes, currentEdges);
            }
            return currentEdges;
          });
          return currentNodes;
        });
      }, 0);
    }
  }, [onEdgesChange, onEdgesChangeExternal, onStateChange, setNodes, setEdges, saveToHistory]);

  const handleConnect = useCallback((params) => {
    setEdges((eds) => {
      const newEdges = addEdge({ ...params, ...defaultEdgeOptions }, eds);
      // Save to history after adding edge
      setTimeout(() => {
        saveToHistory(nodes, newEdges);
        if (onStateChange) {
          onStateChange(nodes, newEdges);
        }
      }, 0);
      return newEdges;
    });
    if (onConnectExternal) {
      onConnectExternal(params);
    }
  }, [setEdges, onConnectExternal, onStateChange, nodes, saveToHistory]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (onDragOver) {
      onDragOver(event);
    }
  }, [onDragOver]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();

    const data = event.dataTransfer.getData('application/reactflow');
    if (!data) return;

    const { type, data: nodeData } = JSON.parse(data);

    // Get the position where the node was dropped
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: nodeData || { label: type.charAt(0).toUpperCase() + type.slice(1) }
    };

    setNodes((nds) => {
      const newNodes = [...nds, newNode];
      // Save to history after adding node
      setTimeout(() => saveToHistory(newNodes, edges), 0);
      return newNodes;
    });

    // Also call external onDrop if provided
    if (onDrop) {
      onDrop(event, reactFlowWrapper.current);
    }
  }, [onDrop, screenToFlowPosition, setNodes, edges, saveToHistory]);

  if (!isMounted) {
    return (
      <div className="workflow-canvas" ref={reactFlowWrapper} style={{ width: '100%', height: 'calc(100vh - 140px)', minHeight: '500px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6c757d' }}>
          Loading canvas...
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-canvas" ref={reactFlowWrapper} style={{ width: '100%', height: 'calc(100vh - 140px)', minHeight: '500px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={onNodeClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={['Backspace', 'Delete']}
        style={{ width: '100%', height: '100%' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap
          nodeStrokeColor={(n) => {
            switch (n.type) {
              case 'start': return '#38a169';
              case 'end': return '#e53e3e';
              case 'agent': return '#667eea';
              case 'condition': return '#ed8936';
              case 'parallel': return '#4fd1c5';
              default: return '#667eea';
            }
          }}
          nodeColor={(n) => {
            switch (n.type) {
              case 'start': return '#c6f6d5';
              case 'end': return '#fed7d7';
              case 'agent': return '#e9d8fd';
              case 'condition': return '#feebc8';
              case 'parallel': return '#b2f5ea';
              default: return '#e9d8fd';
            }
          }}
        />
      </ReactFlow>

      <style>{`
        .workflow-canvas {
          width: 100%;
          height: 100%;
          min-height: 500px;
          background: #f8f9fa;
        }

        :global(.react-flow__node) {
          cursor: pointer;
        }

        :global(.react-flow__edge-path) {
          stroke-width: 2;
        }

        :global(.react-flow__handle) {
          cursor: crosshair;
        }

        :global(.react-flow__controls) {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }

        :global(.react-flow__controls-button) {
          background: white;
          border: none;
          padding: 8px;
        }

        :global(.react-flow__controls-button:hover) {
          background: #f0f0f0;
        }

        :global(.react-flow__minimap) {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
});

export default WorkflowCanvas;

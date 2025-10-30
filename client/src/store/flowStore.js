import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';

const useFlowStore = create((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  isModified: false,

  setNodes: (nodes) => set({ nodes, isModified: true }),
  setEdges: (edges) => set({ edges, isModified: true }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isModified: true
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isModified: true
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
      isModified: true
    });
  },

  addNode: (type, position) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: getDefaultDataForType(type)
    };

    set({
      nodes: [...get().nodes, newNode],
      isModified: true
    });

    return newNode.id;
  },

  updateNode: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      ),
      isModified: true
    });
  },

  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      isModified: true
    });
  },

  selectNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    set({ selectedNode: node });
  },

  clearSelection: () => set({ selectedNode: null }),

  clearFlow: () => {
    set({
      nodes: [],
      edges: [],
      selectedNode: null,
      isModified: false
    });
  },

  loadFlow: (flowData) => {
    if (flowData && flowData.nodes && flowData.edges) {
      set({
        nodes: flowData.nodes,
        edges: flowData.edges,
        isModified: false
      });
    }
  },

  getFlowData: () => {
    return {
      nodes: get().nodes,
      edges: get().edges
    };
  },

  markAsUnmodified: () => set({ isModified: false })
}));

// Helper function to get default data based on node type
function getDefaultDataForType(type) {
  const baseData = {
    onEdit: null // Will be set by FlowBuilder
  };

  switch (type) {
    case 'start':
      return { ...baseData, label: 'Start' };
    case 'text':
      return { ...baseData, content: '' };
    case 'question':
      return { ...baseData, question: '', options: [] };
    case 'condition':
      return { ...baseData, condition: '' };
    case 'end':
      return { ...baseData, label: 'End' };
    default:
      return baseData;
  }
}

export default useFlowStore;

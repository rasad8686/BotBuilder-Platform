import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const MAX_HISTORY_LENGTH = 50;

export const useEmailBuilder = (initialBlocks = []) => {
  const [blocks, setBlocksState] = useState(initialBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [history, setHistory] = useState([initialBlocks]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedo = useRef(false);

  // Add to history when blocks change
  const setBlocks = useCallback((newBlocks) => {
    const blocksArray = typeof newBlocks === 'function' ? newBlocks(blocks) : newBlocks;

    if (!isUndoRedo.current) {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(blocksArray);
        if (newHistory.length > MAX_HISTORY_LENGTH) {
          newHistory.shift();
          return newHistory;
        }
        return newHistory;
      });
      setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_LENGTH - 1));
    }

    isUndoRedo.current = false;
    setBlocksState(blocksArray);
  }, [blocks, historyIndex]);

  // Add a new block
  const addBlock = useCallback((block, index) => {
    const newBlock = {
      ...block,
      id: block.id || uuidv4()
    };

    setBlocks(prev => {
      if (typeof index === 'number') {
        const newBlocks = [...prev];
        newBlocks.splice(index, 0, newBlock);
        return newBlocks;
      }
      return [...prev, newBlock];
    });

    setSelectedBlockId(newBlock.id);
    return newBlock;
  }, [setBlocks]);

  // Update a block
  const updateBlock = useCallback((blockId, updates) => {
    setBlocks(prev =>
      prev.map(block =>
        block.id === blockId
          ? {
              ...block,
              ...updates,
              settings: updates.settings
                ? { ...block.settings, ...updates.settings }
                : block.settings
            }
          : block
      )
    );
  }, [setBlocks]);

  // Delete a block
  const deleteBlock = useCallback((blockId) => {
    setBlocks(prev => {
      const index = prev.findIndex(b => b.id === blockId);
      const newBlocks = prev.filter(b => b.id !== blockId);

      // Select adjacent block after deletion
      if (selectedBlockId === blockId) {
        if (newBlocks.length > 0) {
          const newIndex = Math.min(index, newBlocks.length - 1);
          setSelectedBlockId(newBlocks[newIndex]?.id || null);
        } else {
          setSelectedBlockId(null);
        }
      }

      return newBlocks;
    });
  }, [selectedBlockId, setBlocks]);

  // Move a block
  const moveBlock = useCallback((fromIndex, toIndex) => {
    setBlocks(prev => {
      const newBlocks = [...prev];
      const [removed] = newBlocks.splice(fromIndex, 1);
      newBlocks.splice(toIndex, 0, removed);
      return newBlocks;
    });
  }, [setBlocks]);

  // Duplicate a block
  const duplicateBlock = useCallback((blockId) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const index = blocks.findIndex(b => b.id === blockId);
    const newBlock = {
      ...JSON.parse(JSON.stringify(block)), // Deep clone
      id: uuidv4()
    };

    setBlocks(prev => {
      const newBlocks = [...prev];
      newBlocks.splice(index + 1, 0, newBlock);
      return newBlocks;
    });

    setSelectedBlockId(newBlock.id);
    return newBlock;
  }, [blocks, setBlocks]);

  // Select a block
  const selectBlock = useCallback((blockId) => {
    setSelectedBlockId(blockId);
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedBlockId(null);
  }, []);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedo.current = true;
      setHistoryIndex(prev => prev - 1);
      setBlocksState(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedo.current = true;
      setHistoryIndex(prev => prev + 1);
      setBlocksState(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  // Get selected block
  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || null;

  // Can undo/redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Get block by index
  const getBlockByIndex = useCallback((index) => {
    return blocks[index] || null;
  }, [blocks]);

  // Get block index
  const getBlockIndex = useCallback((blockId) => {
    return blocks.findIndex(b => b.id === blockId);
  }, [blocks]);

  // Reset blocks
  const resetBlocks = useCallback((newBlocks = []) => {
    setBlocksState(newBlocks);
    setHistory([newBlocks]);
    setHistoryIndex(0);
    setSelectedBlockId(null);
  }, []);

  // Move block up
  const moveBlockUp = useCallback((blockId) => {
    const index = blocks.findIndex(b => b.id === blockId);
    if (index > 0) {
      moveBlock(index, index - 1);
    }
  }, [blocks, moveBlock]);

  // Move block down
  const moveBlockDown = useCallback((blockId) => {
    const index = blocks.findIndex(b => b.id === blockId);
    if (index < blocks.length - 1) {
      moveBlock(index, index + 1);
    }
  }, [blocks, moveBlock]);

  return {
    blocks,
    setBlocks,
    selectedBlockId,
    selectedBlock,
    addBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    duplicateBlock,
    selectBlock,
    clearSelection,
    undo,
    redo,
    canUndo,
    canRedo,
    getBlockByIndex,
    getBlockIndex,
    resetBlocks,
    moveBlockUp,
    moveBlockDown,
    historyLength: history.length,
    currentHistoryIndex: historyIndex
  };
};

export default useEmailBuilder;

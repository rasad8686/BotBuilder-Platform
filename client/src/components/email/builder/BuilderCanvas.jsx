import React, { useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';

const BuilderCanvas = ({ children, onDrop }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-drop-zone'
  });

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const blockData = e.dataTransfer.getData('block-data');
    if (blockData && onDrop) {
      try {
        const block = JSON.parse(blockData);
        onDrop({
          ...block,
          id: block.id || uuidv4()
        });
      } catch (err) {
        console.error('Failed to parse dropped block data:', err);
      }
    }
  }, [onDrop]);

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[600px] transition-colors ${
        isOver ? 'bg-purple-50 dark:bg-purple-900/10' : ''
      }`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drop indicator when dragging */}
      {isOver && (
        <div className="mx-4 my-2 border-2 border-dashed border-purple-400 rounded-lg p-4 text-center text-sm text-purple-600">
          Drop block here
        </div>
      )}
    </div>
  );
};

export default BuilderCanvas;

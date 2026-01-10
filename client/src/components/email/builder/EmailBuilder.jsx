import React, { useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Mail, Plus } from 'lucide-react';
import BuilderCanvas from './BuilderCanvas';
import EmailBlock from './EmailBlock';

const EmailBuilder = ({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
  onMoveBlock,
  onAddBlock
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const [activeId, setActiveId] = React.useState(null);

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => b.id === active.id);
      const newIndex = blocks.findIndex(b => b.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onMoveBlock(oldIndex, newIndex);
      }
    }

    setActiveId(null);
  }, [blocks, onMoveBlock]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeBlock = activeId ? blocks.find(b => b.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden min-h-[600px]">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[600px] p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <Mail className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Start Building Your Email
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
              Drag and drop content blocks from the left sidebar or click the button below to add your first block.
            </p>
            <button
              onClick={() => onAddBlock({
                type: 'text',
                content: '<p>Start writing your email content here...</p>',
                settings: {
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '16px',
                  color: '#333333',
                  lineHeight: '1.5',
                  textAlign: 'left',
                  padding: { top: 10, right: 20, bottom: 10, left: 20 },
                  backgroundColor: 'transparent'
                }
              })}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Text Block
            </button>
          </div>
        ) : (
          <SortableContext
            items={blocks.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <BuilderCanvas>
              {blocks.map((block, index) => (
                <EmailBlock
                  key={block.id}
                  block={block}
                  index={index}
                  isSelected={selectedBlockId === block.id}
                  onSelect={() => onSelectBlock(block.id)}
                  onUpdate={(updates) => onUpdateBlock(block.id, updates)}
                  onDelete={() => onDeleteBlock(block.id)}
                />
              ))}
            </BuilderCanvas>
          </SortableContext>
        )}
      </div>

      <DragOverlay>
        {activeBlock ? (
          <div className="opacity-80 shadow-2xl">
            <EmailBlock
              block={activeBlock}
              index={0}
              isSelected={false}
              isDragging
              onSelect={() => {}}
              onUpdate={() => {}}
              onDelete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default EmailBuilder;

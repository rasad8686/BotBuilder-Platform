import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Copy,
  Settings
} from 'lucide-react';

// Import block renderers
import TextBlock from '../blocks/TextBlock';
import ImageBlock from '../blocks/ImageBlock';
import ButtonBlock from '../blocks/ButtonBlock';
import DividerBlock from '../blocks/DividerBlock';
import SpacerBlock from '../blocks/SpacerBlock';
import SocialBlock from '../blocks/SocialBlock';
import ColumnsBlock from '../blocks/ColumnsBlock';
import HeaderBlock from '../blocks/HeaderBlock';
import FooterBlock from '../blocks/FooterBlock';
import HTMLBlock from '../blocks/HTMLBlock';
import VideoBlock from '../blocks/VideoBlock';

const BLOCK_COMPONENTS = {
  text: TextBlock,
  image: ImageBlock,
  button: ButtonBlock,
  divider: DividerBlock,
  spacer: SpacerBlock,
  social: SocialBlock,
  columns: ColumnsBlock,
  header: HeaderBlock,
  footer: FooterBlock,
  html: HTMLBlock,
  video: VideoBlock
};

const EmailBlock = ({
  block,
  index,
  isSelected,
  isDragging,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1
  };

  const BlockComponent = BLOCK_COMPONENTS[block.type];

  if (!BlockComponent) {
    return (
      <div className="p-4 bg-red-50 text-red-600 text-sm rounded">
        Unknown block type: {block.type}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isDragging ? 'z-50' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Selection border */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all ${
          isSelected
            ? 'ring-2 ring-purple-500 ring-offset-2'
            : 'ring-0 group-hover:ring-2 group-hover:ring-purple-300'
        }`}
      />

      {/* Block toolbar */}
      <div
        className={`absolute -top-8 left-0 flex items-center gap-1 bg-white dark:bg-gray-800 rounded-t-lg shadow-sm border border-gray-200 dark:border-gray-700 px-1 py-1 z-10 transition-opacity ${
          isSelected || isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

        {/* Block type label */}
        <span className="px-2 text-xs text-gray-500 dark:text-gray-400 capitalize">
          {block.type}
        </span>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

        {/* Duplicate */}
        {onDuplicate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
            title="Duplicate block (Ctrl+D)"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          title="Delete block (Delete)"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Block content */}
      <BlockComponent
        block={block}
        onUpdate={onUpdate}
        isEditing={isSelected}
      />
    </div>
  );
};

export default EmailBlock;

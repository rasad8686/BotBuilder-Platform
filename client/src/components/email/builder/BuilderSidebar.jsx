import React, { useState } from 'react';
import {
  Type,
  Image,
  MousePointer2,
  Minus,
  Space,
  Share2,
  Columns,
  LayoutTemplate,
  FileText,
  Code,
  Video,
  ChevronDown,
  ChevronRight,
  GripVertical
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const BLOCK_CATEGORIES = [
  {
    id: 'layout',
    name: 'Layout',
    icon: LayoutTemplate,
    blocks: [
      {
        type: 'columns',
        name: '2 Columns',
        icon: Columns,
        defaultData: {
          type: 'columns',
          settings: {
            columns: 2,
            columnGap: '20px',
            stackOnMobile: true
          },
          children: [
            { blocks: [] },
            { blocks: [] }
          ]
        }
      },
      {
        type: 'columns-3',
        name: '3 Columns',
        icon: Columns,
        defaultData: {
          type: 'columns',
          settings: {
            columns: 3,
            columnGap: '15px',
            stackOnMobile: true
          },
          children: [
            { blocks: [] },
            { blocks: [] },
            { blocks: [] }
          ]
        }
      }
    ]
  },
  {
    id: 'content',
    name: 'Content',
    icon: FileText,
    blocks: [
      {
        type: 'text',
        name: 'Text',
        icon: Type,
        defaultData: {
          type: 'text',
          content: '<p>Your text here...</p>',
          settings: {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: '#333333',
            lineHeight: '1.5',
            textAlign: 'left',
            padding: { top: 10, right: 20, bottom: 10, left: 20 },
            backgroundColor: 'transparent'
          }
        }
      },
      {
        type: 'image',
        name: 'Image',
        icon: Image,
        defaultData: {
          type: 'image',
          settings: {
            src: '',
            alt: '',
            link: '',
            width: '100%',
            align: 'center',
            padding: { top: 10, right: 0, bottom: 10, left: 0 },
            borderRadius: '0px'
          }
        }
      },
      {
        type: 'button',
        name: 'Button',
        icon: MousePointer2,
        defaultData: {
          type: 'button',
          settings: {
            text: 'Click Here',
            url: '',
            backgroundColor: '#7C3AED',
            textColor: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: { top: 12, right: 24, bottom: 12, left: 24 },
            borderRadius: '6px',
            align: 'center',
            fullWidth: false
          }
        }
      },
      {
        type: 'divider',
        name: 'Divider',
        icon: Minus,
        defaultData: {
          type: 'divider',
          settings: {
            style: 'solid',
            color: '#E5E7EB',
            thickness: '1px',
            width: '100%',
            padding: { top: 20, right: 0, bottom: 20, left: 0 }
          }
        }
      },
      {
        type: 'spacer',
        name: 'Spacer',
        icon: Space,
        defaultData: {
          type: 'spacer',
          settings: {
            height: '40px'
          }
        }
      }
    ]
  },
  {
    id: 'social',
    name: 'Social',
    icon: Share2,
    blocks: [
      {
        type: 'social',
        name: 'Social Icons',
        icon: Share2,
        defaultData: {
          type: 'social',
          settings: {
            platforms: [
              { name: 'facebook', url: '', enabled: true },
              { name: 'twitter', url: '', enabled: true },
              { name: 'instagram', url: '', enabled: true },
              { name: 'linkedin', url: '', enabled: false },
              { name: 'youtube', url: '', enabled: false }
            ],
            iconStyle: 'colored',
            iconSize: '32px',
            align: 'center',
            spacing: '10px',
            padding: { top: 10, right: 0, bottom: 10, left: 0 }
          }
        }
      }
    ]
  },
  {
    id: 'structure',
    name: 'Structure',
    icon: LayoutTemplate,
    blocks: [
      {
        type: 'header',
        name: 'Header',
        icon: LayoutTemplate,
        defaultData: {
          type: 'header',
          settings: {
            logo: '',
            logoWidth: '150px',
            logoAlign: 'center',
            backgroundColor: '#FFFFFF',
            padding: { top: 20, right: 20, bottom: 20, left: 20 }
          }
        }
      },
      {
        type: 'footer',
        name: 'Footer',
        icon: LayoutTemplate,
        defaultData: {
          type: 'footer',
          settings: {
            companyName: '{{company_name}}',
            address: '{{company_address}}',
            showUnsubscribe: true,
            unsubscribeText: 'Unsubscribe',
            showViewInBrowser: true,
            backgroundColor: '#F9FAFB',
            textColor: '#6B7280',
            fontSize: '12px',
            padding: { top: 30, right: 20, bottom: 30, left: 20 }
          }
        }
      }
    ]
  },
  {
    id: 'advanced',
    name: 'Advanced',
    icon: Code,
    blocks: [
      {
        type: 'html',
        name: 'HTML',
        icon: Code,
        defaultData: {
          type: 'html',
          content: '<div>Custom HTML here</div>',
          settings: {}
        }
      },
      {
        type: 'video',
        name: 'Video',
        icon: Video,
        defaultData: {
          type: 'video',
          settings: {
            thumbnailUrl: '',
            videoUrl: '',
            playButtonColor: '#FF0000',
            width: '100%',
            padding: { top: 10, right: 0, bottom: 10, left: 0 }
          }
        }
      }
    ]
  }
];

const BuilderSidebar = ({ onAddBlock }) => {
  const [expandedCategories, setExpandedCategories] = useState(
    BLOCK_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: true }), {})
  );

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const handleAddBlock = (blockDef) => {
    const newBlock = {
      ...blockDef.defaultData,
      id: uuidv4()
    };
    onAddBlock(newBlock);
  };

  return (
    <div className="p-2">
      {BLOCK_CATEGORIES.map(category => {
        const CategoryIcon = category.icon;
        const isExpanded = expandedCategories[category.id];

        return (
          <div key={category.id} className="mb-2">
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-2">
                <CategoryIcon className="w-4 h-4" />
                {category.name}
              </span>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {isExpanded && (
              <div className="mt-1 grid grid-cols-2 gap-1">
                {category.blocks.map(block => {
                  const BlockIcon = block.icon;
                  return (
                    <button
                      key={block.type}
                      onClick={() => handleAddBlock(block)}
                      className="flex flex-col items-center gap-1 p-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('block-type', JSON.stringify(block.defaultData));
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                        <BlockIcon className="w-5 h-5 group-hover:text-purple-600" />
                      </div>
                      <span className="text-xs text-center">{block.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Quick Tips
        </h4>
        <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <li className="flex items-start gap-1">
            <GripVertical className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>Drag blocks to reorder</span>
          </li>
          <li>Click a block to edit it</li>
          <li>Ctrl+Z to undo, Ctrl+Shift+Z to redo</li>
          <li>Delete key to remove selected block</li>
        </ul>
      </div>
    </div>
  );
};

export default BuilderSidebar;

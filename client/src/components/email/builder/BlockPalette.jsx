import React from 'react';
import {
  Type,
  Image,
  MousePointer2,
  Minus,
  Space,
  Share2,
  Columns,
  LayoutTemplate,
  Code,
  Video,
  GripVertical
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const BLOCKS = [
  {
    type: 'text',
    name: 'Text',
    icon: Type,
    description: 'Add text content',
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
    description: 'Add an image',
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
    description: 'Add a CTA button',
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
    description: 'Add a horizontal line',
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
    description: 'Add vertical space',
    defaultData: {
      type: 'spacer',
      settings: {
        height: '40px'
      }
    }
  },
  {
    type: 'social',
    name: 'Social',
    icon: Share2,
    description: 'Add social links',
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
  },
  {
    type: 'columns',
    name: 'Columns',
    icon: Columns,
    description: 'Add column layout',
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
    type: 'header',
    name: 'Header',
    icon: LayoutTemplate,
    description: 'Add email header',
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
    description: 'Add email footer',
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
  },
  {
    type: 'html',
    name: 'HTML',
    icon: Code,
    description: 'Add custom HTML',
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
    description: 'Add video thumbnail',
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
];

const BlockPalette = ({ onAddBlock }) => {
  const handleAddBlock = (blockDef) => {
    const newBlock = {
      ...blockDef.defaultData,
      id: uuidv4()
    };
    onAddBlock(newBlock);
  };

  const handleDragStart = (e, blockDef) => {
    e.dataTransfer.setData('block-data', JSON.stringify({
      ...blockDef.defaultData,
      id: uuidv4()
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="grid grid-cols-3 gap-2 p-4">
      {BLOCKS.map(block => {
        const Icon = block.icon;
        return (
          <div
            key={block.type}
            className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 hover:shadow-sm transition-all group"
            onClick={() => handleAddBlock(block)}
            draggable
            onDragStart={(e) => handleDragStart(e, block)}
          >
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
              <Icon className="w-6 h-6 text-gray-500 group-hover:text-purple-600 transition-colors" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">
              {block.name}
            </span>
            <span className="text-[10px] text-gray-400 text-center mt-0.5 hidden group-hover:block">
              {block.description}
            </span>
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-50 transition-opacity">
              <GripVertical className="w-3 h-3 text-gray-400" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BlockPalette;

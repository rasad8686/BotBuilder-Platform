import React from 'react';

const PluginTags = ({
  tags = [],
  category,
  permissions = [],
  showPermissions = false,
  maxTags = 5,
  onTagClick,
  size = 'medium', // small, medium, large
  className = ''
}) => {
  // Combine all tag sources
  const allTags = [];

  // Add category as first tag
  if (category) {
    allTags.push({
      type: 'category',
      label: category,
      icon: '&#128193;'
    });
  }

  // Add custom tags
  tags.forEach(tag => {
    allTags.push({
      type: 'tag',
      label: typeof tag === 'string' ? tag : tag.label,
      color: typeof tag === 'object' ? tag.color : null
    });
  });

  // Add permission tags if enabled
  if (showPermissions && permissions.length > 0) {
    permissions.slice(0, 3).forEach(perm => {
      allTags.push({
        type: 'permission',
        label: formatPermission(perm),
        icon: getPermissionIcon(perm)
      });
    });

    if (permissions.length > 3) {
      allTags.push({
        type: 'permission',
        label: `+${permissions.length - 3} more`,
        isExtra: true
      });
    }
  }

  const displayTags = allTags.slice(0, maxTags);
  const extraCount = allTags.length - maxTags;

  const handleClick = (tag) => {
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  return (
    <div className={`plugin-tags ${size} ${className}`}>
      {displayTags.map((tag, index) => (
        <span
          key={index}
          className={`tag ${tag.type} ${tag.isExtra ? 'extra' : ''} ${onTagClick ? 'clickable' : ''}`}
          style={tag.color ? { background: tag.color } : {}}
          onClick={() => handleClick(tag)}
          dangerouslySetInnerHTML={{
            __html: tag.icon ? `${tag.icon} ${tag.label}` : tag.label
          }}
        />
      ))}

      {extraCount > 0 && (
        <span className="tag extra">+{extraCount}</span>
      )}

      <style>{`
        .plugin-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .tag.clickable {
          cursor: pointer;
        }

        .tag.clickable:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        /* Tag types */
        .tag.category {
          background: linear-gradient(135deg, #667eea10 0%, #764ba210 100%);
          color: #667eea;
          border: 1px solid #667eea30;
        }

        .tag.tag {
          background: #f3f4f6;
          color: #4b5563;
        }

        .tag.permission {
          background: #fef3c7;
          color: #d97706;
        }

        .tag.extra {
          background: #e5e7eb;
          color: #6b7280;
        }

        /* Sizes */
        .plugin-tags.small .tag {
          padding: 2px 8px;
          font-size: 11px;
          border-radius: 12px;
        }

        .plugin-tags.medium .tag {
          padding: 4px 10px;
          font-size: 12px;
          border-radius: 16px;
        }

        .plugin-tags.large .tag {
          padding: 6px 14px;
          font-size: 14px;
          border-radius: 20px;
        }

        /* Predefined colors */
        .tag.color-blue {
          background: #dbeafe;
          color: #2563eb;
        }

        .tag.color-green {
          background: #d1fae5;
          color: #059669;
        }

        .tag.color-red {
          background: #fee2e2;
          color: #dc2626;
        }

        .tag.color-yellow {
          background: #fef3c7;
          color: #d97706;
        }

        .tag.color-purple {
          background: #ede9fe;
          color: #7c3aed;
        }
      `}</style>
    </div>
  );
};

// Helper functions
function formatPermission(permission) {
  return permission
    .replace(/:/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getPermissionIcon(permission) {
  const icons = {
    'read': '&#128065;',
    'write': '&#9998;',
    'network': '&#127760;',
    'storage': '&#128190;',
    'user': '&#128100;',
    'admin': '&#128272;',
    'agent': '&#129302;',
    'flow': '&#8644;',
    'analytics': '&#128200;'
  };

  const key = permission.split(':')[0];
  return icons[key] || '&#128274;';
}

export default PluginTags;

import React from 'react';

const WorkflowNode = ({
  icon,
  iconBg,
  title,
  subtitle,
  stats,
  isSelected,
  onSelect,
  onDelete,
  children
}) => {
  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-lg border-2 p-4 w-64 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 shadow-lg'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100"
          style={{ opacity: isSelected ? 1 : undefined }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Content */}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{title}</h4>
          {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
          {stats}
        </div>
      )}

      {/* Custom content */}
      {children}

      {/* Connection points */}
      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-300 rounded-full border-2 border-white"></div>
    </div>
  );
};

export default WorkflowNode;

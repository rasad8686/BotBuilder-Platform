import React from 'react';

const WaitNode = ({ step, index, isSelected, onSelect, onDelete }) => {
  const getWaitDisplay = (config) => {
    if (!config) return 'Not configured';
    const value = config.value || 1;
    const unit = config.unit || 'days';
    return `Wait ${value} ${unit}`;
  };

  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-lg border-2 p-4 w-64 cursor-pointer transition-all group ${
        isSelected
          ? 'border-blue-500 shadow-lg'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* Step number */}
      <div className="absolute -top-3 -left-3 w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
        {index + 1}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={`absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">Wait</h4>
          <p className="text-sm text-gray-500">{getWaitDisplay(step.config)}</p>
        </div>
      </div>

      {/* Currently waiting count */}
      {step.stats?.waiting > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {step.stats.waiting} currently waiting
          </span>
        </div>
      )}

      {/* Connection point */}
      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-300 rounded-full border-2 border-white"></div>
    </div>
  );
};

export default WaitNode;

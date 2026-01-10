import React from 'react';
import WorkflowConnection from './WorkflowConnection';

const ConditionNode = ({ step, index, isSelected, onSelect, onDelete }) => {
  const getConditionInfo = (config) => {
    switch (config?.type) {
      case 'opened_email':
        return 'Opened email?';
      case 'clicked_link':
        return 'Clicked link?';
      case 'has_tag':
        return `Has tag "${config?.tag || '...'}"?`;
      case 'in_segment':
        return 'In segment?';
      default:
        return 'Check condition';
    }
  };

  return (
    <div className="flex flex-col items-center">
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

        {/* Condition Badge */}
        <div className="absolute -top-3 left-8 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
          CONDITION
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
        <div className="flex items-center gap-3 mt-2">
          <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900">If/Else</h4>
            <p className="text-sm text-gray-500 truncate">{getConditionInfo(step.config)}</p>
          </div>
        </div>

        {/* Branching indicator */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
          <span className="text-green-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Yes
          </span>
          <span className="text-red-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            No
          </span>
        </div>

        {/* Connection points */}
        <div className="absolute -bottom-1 left-1/4 transform -translate-x-1/2 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
        <div className="absolute -bottom-1 left-3/4 transform -translate-x-1/2 w-3 h-3 bg-red-400 rounded-full border-2 border-white"></div>
      </div>

      {/* Branch Lines (visual only) */}
      <div className="flex justify-center gap-32 mt-2">
        <div className="flex flex-col items-center">
          <WorkflowConnection variant="yes" label="Yes" />
          <div className="w-32 h-20 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
            + Add step
          </div>
        </div>
        <div className="flex flex-col items-center">
          <WorkflowConnection variant="no" label="No" />
          <div className="w-32 h-20 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
            + Add step
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConditionNode;

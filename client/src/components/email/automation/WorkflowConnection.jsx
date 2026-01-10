import React from 'react';

const WorkflowConnection = ({ label, variant = 'default' }) => {
  const getColor = () => {
    switch (variant) {
      case 'yes':
        return 'border-green-400';
      case 'no':
        return 'border-red-400';
      default:
        return 'border-gray-300';
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Line */}
      <div className={`w-0.5 h-8 border-l-2 border-dashed ${getColor()}`}></div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-gray-400 -mt-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>

      {/* Label */}
      {label && (
        <span className={`absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded bg-white ${
          variant === 'yes' ? 'text-green-600' : variant === 'no' ? 'text-red-600' : 'text-gray-500'
        }`}>
          {label}
        </span>
      )}
    </div>
  );
};

export default WorkflowConnection;

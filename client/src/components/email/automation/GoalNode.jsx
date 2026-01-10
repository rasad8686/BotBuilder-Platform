import React from 'react';

const GoalNode = ({ step, index, isSelected, onSelect, onDelete }) => {
  const isExit = step.type === 'exit';

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

      {/* Badge */}
      <div className={`absolute -top-3 left-8 px-2 py-0.5 text-xs font-medium rounded ${
        isExit ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
      }`}>
        {isExit ? 'EXIT' : 'GOAL'}
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
        <div className={`p-2 rounded-lg ${isExit ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {isExit ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">{isExit ? 'Exit' : 'Goal'}</h4>
          <p className="text-sm text-gray-500 truncate">
            {isExit ? 'Exit automation' : (step.config?.name || 'Goal achieved')}
          </p>
        </div>
      </div>

      {/* Conversion stats */}
      {!isExit && step.stats && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
          <span>Achieved: {step.stats.achieved || 0}</span>
          <span className="text-green-600 font-medium">{step.stats.rate || 0}% rate</span>
        </div>
      )}

      {/* No connection point for exit nodes */}
      {!isExit && (
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-300 rounded-full border-2 border-white"></div>
      )}
    </div>
  );
};

export default GoalNode;

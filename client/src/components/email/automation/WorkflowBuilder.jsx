import React from 'react';
import WorkflowCanvas from './WorkflowCanvas';

const WorkflowBuilder = ({
  triggerConfig,
  steps,
  selectedStepIndex,
  onSelectTrigger,
  onSelectStep,
  onAddStep,
  onUpdateStep,
  onDeleteStep
}) => {
  return (
    <div className="min-h-full">
      {/* Zoom Controls */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 px-3 py-2 z-10">
        <button className="p-1 hover:bg-gray-100 rounded">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <span className="text-sm text-gray-600 px-2">100%</span>
        <button className="p-1 hover:bg-gray-100 rounded">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1"></div>
        <button className="p-1 hover:bg-gray-100 rounded">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Canvas */}
      <WorkflowCanvas
        triggerConfig={triggerConfig}
        steps={steps}
        selectedStepIndex={selectedStepIndex}
        onSelectTrigger={onSelectTrigger}
        onSelectStep={onSelectStep}
        onAddStep={onAddStep}
        onDeleteStep={onDeleteStep}
      />
    </div>
  );
};

export default WorkflowBuilder;

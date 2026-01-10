import React from 'react';
import TriggerNode from './TriggerNode';
import ActionNode from './ActionNode';
import ConditionNode from './ConditionNode';
import WaitNode from './WaitNode';
import GoalNode from './GoalNode';
import WorkflowConnection from './WorkflowConnection';

const WorkflowCanvas = ({
  triggerConfig,
  steps,
  selectedStepIndex,
  onSelectTrigger,
  onSelectStep,
  onAddStep,
  onDeleteStep
}) => {
  const renderNode = (step, index) => {
    const isSelected = selectedStepIndex === index;
    const commonProps = {
      step,
      index,
      isSelected,
      onSelect: () => onSelectStep(step, index),
      onDelete: () => onDeleteStep(index)
    };

    switch (step.type) {
      case 'send_email':
      case 'add_tag':
      case 'remove_tag':
      case 'add_to_list':
      case 'remove_from_list':
      case 'notify':
      case 'webhook':
        return <ActionNode key={step.id} {...commonProps} />;
      case 'wait':
        return <WaitNode key={step.id} {...commonProps} />;
      case 'condition':
        return <ConditionNode key={step.id} {...commonProps} />;
      case 'goal':
      case 'exit':
        return <GoalNode key={step.id} {...commonProps} />;
      default:
        return <ActionNode key={step.id} {...commonProps} />;
    }
  };

  return (
    <div className="flex flex-col items-center py-8">
      {/* Trigger Node */}
      <TriggerNode
        config={triggerConfig}
        isSelected={selectedStepIndex === -1}
        onSelect={onSelectTrigger}
      />

      {/* Connection from trigger */}
      {steps.length > 0 && <WorkflowConnection />}

      {/* Add button after trigger if no steps */}
      {steps.length === 0 && (
        <div className="my-4">
          <button
            onClick={() => onAddStep('send_email', 0)}
            className="w-10 h-10 bg-white border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center hover:border-blue-500 hover:text-blue-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}

      {/* Workflow Steps */}
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          {renderNode(step, index)}

          {/* Connection to next step */}
          {index < steps.length - 1 && <WorkflowConnection />}

          {/* Add button between steps or at end */}
          {index === steps.length - 1 && (
            <div className="my-4">
              <button
                onClick={() => onAddStep('send_email', index + 1)}
                className="w-10 h-10 bg-white border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center hover:border-blue-500 hover:text-blue-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default WorkflowCanvas;

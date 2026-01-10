import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAutomationQuery, useCreateAutomationMutation, useUpdateAutomationMutation, useActivateAutomationMutation, usePauseAutomationMutation } from '../../hooks/email/useAutomations';
import WorkflowBuilder from '../../components/email/automation/WorkflowBuilder';
import StepsPalette from '../../components/email/automation/StepsPalette';
import TriggerSettings from '../../components/email/automation/settings/TriggerSettings';
import SendEmailSettings from '../../components/email/automation/settings/SendEmailSettings';
import WaitSettings from '../../components/email/automation/settings/WaitSettings';
import ConditionSettings from '../../components/email/automation/settings/ConditionSettings';
import TagSettings from '../../components/email/automation/settings/TagSettings';
import ListSettings from '../../components/email/automation/settings/ListSettings';
import WebhookSettings from '../../components/email/automation/settings/WebhookSettings';
import GoalSettings from '../../components/email/automation/settings/GoalSettings';

const AutomationBuilderPage = () => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const id = paramId && paramId !== 'new' && paramId !== 'undefined' ? paramId : null;
  const isEditing = !!id;

  const { data: existingAutomation, isLoading } = useAutomationQuery(id);
  const createAutomation = useCreateAutomationMutation();
  const updateAutomation = useUpdateAutomationMutation();
  const activateAutomation = useActivateAutomationMutation();
  const pauseAutomation = usePauseAutomationMutation();

  const [automationName, setAutomationName] = useState('Untitled Automation');
  const [status, setStatus] = useState('draft');
  const [triggerConfig, setTriggerConfig] = useState({ type: 'subscribes' });
  const [steps, setSteps] = useState([]);
  const [selectedStep, setSelectedStep] = useState(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (existingAutomation) {
      setAutomationName(existingAutomation.name);
      setStatus(existingAutomation.status);
      setTriggerConfig(existingAutomation.trigger_config || { type: 'subscribes' });
      setSteps(existingAutomation.steps || []);
    }
  }, [existingAutomation]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const automationData = {
        name: automationName,
        trigger_config: triggerConfig,
        steps,
        status
      };

      if (isEditing) {
        await updateAutomation.mutateAsync({ id, ...automationData });
        return id;
      } else {
        const result = await createAutomation.mutateAsync(automationData);
        navigate(`/email/automations/${result.id}`, { replace: true });
        return result.id;
      }
    } catch (error) {
      console.error('Failed to save automation:', error);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async () => {
    let automationId = id;
    if (!isEditing) {
      automationId = await handleSave();
      if (!automationId) return;
    }
    await activateAutomation.mutateAsync(automationId);
    setStatus('active');
  };

  const handlePause = async () => {
    await pauseAutomation.mutateAsync(id);
    setStatus('paused');
  };

  const handleAddStep = useCallback((stepType, insertIndex = -1) => {
    const newStep = {
      id: `step_${Date.now()}`,
      type: stepType,
      config: getDefaultConfig(stepType)
    };

    setSteps(prev => {
      if (insertIndex === -1) {
        return [...prev, newStep];
      }
      const updated = [...prev];
      updated.splice(insertIndex, 0, newStep);
      return updated;
    });
  }, []);

  const handleUpdateStep = useCallback((index, updates) => {
    setSteps(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
    if (selectedStepIndex === index) {
      setSelectedStep(prev => ({ ...prev, ...updates }));
    }
  }, [selectedStepIndex]);

  const handleDeleteStep = useCallback((index) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
    if (selectedStepIndex === index) {
      setSelectedStep(null);
      setSelectedStepIndex(-1);
    }
  }, [selectedStepIndex]);

  const handleSelectStep = useCallback((step, index) => {
    setSelectedStep(step);
    setSelectedStepIndex(index);
  }, []);

  const handleSelectTrigger = useCallback(() => {
    setSelectedStep({ type: 'trigger', config: triggerConfig });
    setSelectedStepIndex(-1);
  }, [triggerConfig]);

  const handleUpdateTrigger = useCallback((updates) => {
    setTriggerConfig(prev => ({ ...prev, ...updates }));
    setSelectedStep(prev => ({ ...prev, config: { ...prev.config, ...updates } }));
  }, []);

  const getDefaultConfig = (stepType) => {
    switch (stepType) {
      case 'send_email':
        return { template_id: null, subject: '' };
      case 'wait':
        return { value: 1, unit: 'days' };
      case 'add_tag':
      case 'remove_tag':
        return { tag: '' };
      case 'add_to_list':
      case 'remove_from_list':
        return { list_id: null };
      case 'condition':
        return { type: 'opened_email', yes_branch: null, no_branch: null };
      case 'webhook':
        return { url: '', method: 'POST', headers: {} };
      case 'notify':
        return { message: '', channel: 'email' };
      case 'goal':
        return { name: '', condition: {} };
      case 'exit':
        return {};
      default:
        return {};
    }
  };

  const renderSettings = () => {
    if (!selectedStep) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">Select a step to configure</p>
        </div>
      );
    }

    const commonProps = {
      config: selectedStep.config || selectedStep,
      onUpdate: selectedStep.type === 'trigger' ? handleUpdateTrigger : (updates) => handleUpdateStep(selectedStepIndex, { config: { ...selectedStep.config, ...updates } })
    };

    switch (selectedStep.type) {
      case 'trigger':
        return <TriggerSettings {...commonProps} />;
      case 'send_email':
        return <SendEmailSettings {...commonProps} />;
      case 'wait':
        return <WaitSettings {...commonProps} />;
      case 'condition':
        return <ConditionSettings {...commonProps} />;
      case 'add_tag':
      case 'remove_tag':
        return <TagSettings {...commonProps} action={selectedStep.type} />;
      case 'add_to_list':
      case 'remove_from_list':
        return <ListSettings {...commonProps} action={selectedStep.type} />;
      case 'webhook':
        return <WebhookSettings {...commonProps} />;
      case 'goal':
        return <GoalSettings {...commonProps} />;
      default:
        return <div className="p-4 text-gray-500">No settings available</div>;
    }
  };

  if (isLoading && isEditing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/email/automations')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <input
            type="text"
            value={automationName || ''}
            onChange={(e) => setAutomationName(e.target.value)}
            className="text-xl font-semibold border-0 focus:ring-0 bg-transparent"
            placeholder="Automation name"
          />
          <span className={`px-2 py-1 rounded text-sm ${
            status === 'active' ? 'bg-green-100 text-green-700' :
            status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          {status === 'active' ? (
            <button
              onClick={handlePause}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={handleActivate}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Activate
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Steps Palette */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <StepsPalette onAddStep={handleAddStep} />
        </div>

        {/* Center - Workflow Canvas */}
        <div className="flex-1 overflow-auto p-6">
          <WorkflowBuilder
            triggerConfig={triggerConfig}
            steps={steps}
            selectedStepIndex={selectedStepIndex}
            onSelectTrigger={handleSelectTrigger}
            onSelectStep={handleSelectStep}
            onAddStep={handleAddStep}
            onUpdateStep={handleUpdateStep}
            onDeleteStep={handleDeleteStep}
          />
        </div>

        {/* Right Sidebar - Step Settings */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">
              {selectedStep ? (selectedStep.type === 'trigger' ? 'Trigger Settings' : 'Step Settings') : 'Settings'}
            </h3>
          </div>
          <div className="p-4">
            {renderSettings()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationBuilderPage;

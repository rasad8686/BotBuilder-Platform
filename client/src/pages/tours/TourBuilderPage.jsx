import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Save,
  Play,
  Eye,
  Settings,
  Target,
  List,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, ErrorState } from '../../components/ui/States';
import TourStepsList from '../../components/tours/TourStepsList';
import TourStepEditor from '../../components/tours/TourStepEditor';
import TourSettingsForm from '../../components/tours/TourSettingsForm';
import TourTargetingForm from '../../components/tours/TourTargetingForm';
import TourPreview from '../../components/tours/TourPreview';
import {
  useTourQuery,
  useCreateTourMutation,
  useUpdateTourMutation,
  usePublishTourMutation,
  useReorderStepsMutation
} from '../../hooks/useTours';

const TABS = {
  STEPS: 'steps',
  SETTINGS: 'settings',
  TARGETING: 'targeting'
};

export default function TourBuilderPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // State
  const [activeTab, setActiveTab] = useState(TABS.STEPS);
  const [selectedStepIndex, setSelectedStepIndex] = useState(null);
  const [showPreview, setShowPreview] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Form state
  const [tourData, setTourData] = useState({
    name: '',
    description: '',
    status: 'draft',
    steps: [],
    settings: {
      dismissible: true,
      showProgressBar: true,
      showStepNumbers: true,
      allowSkip: true,
      theme: {
        primaryColor: '#7c3aed',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        borderRadius: '8px'
      }
    },
    trigger: {
      type: 'manual', // manual, auto, delay, event
      delay: 0,
      eventName: ''
    },
    targeting: {
      rules: [],
      logic: 'AND' // AND or OR
    }
  });

  // Queries & Mutations
  const { data: existingTour, isLoading, error } = useTourQuery(id, { enabled: isEditMode });
  const createMutation = useCreateTourMutation();
  const updateMutation = useUpdateTourMutation();
  const publishMutation = usePublishTourMutation();
  const reorderMutation = useReorderStepsMutation();

  // Load existing tour data
  useEffect(() => {
    if (existingTour) {
      setTourData(existingTour);
    }
  }, [existingTour]);

  // Track unsaved changes
  useEffect(() => {
    if (isEditMode && existingTour) {
      const hasChanges = JSON.stringify(tourData) !== JSON.stringify(existingTour);
      setHasUnsavedChanges(hasChanges);
    } else if (!isEditMode && tourData.name) {
      setHasUnsavedChanges(true);
    }
  }, [tourData, existingTour, isEditMode]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handlers
  const handleSave = async () => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({ id, data: tourData });
      } else {
        const newTour = await createMutation.mutateAsync(tourData);
        navigate(`/tours/${newTour.id}`, { replace: true });
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save tour:', error);
    }
  };

  const handlePublish = async () => {
    try {
      await handleSave();
      await publishMutation.mutateAsync(id || tourData.id);
    } catch (error) {
      console.error('Failed to publish tour:', error);
    }
  };

  const handleAddStep = () => {
    const newStep = {
      id: `step-${Date.now()}`,
      type: 'tooltip',
      title: '',
      content: '',
      target: '',
      position: 'bottom',
      actions: [
        { type: 'next', label: t('tours.next', 'Next') }
      ]
    };

    setTourData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
    setSelectedStepIndex(tourData.steps.length);
  };

  const handleUpdateStep = (index, updates) => {
    setTourData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, ...updates } : step
      )
    }));
  };

  const handleDeleteStep = (index) => {
    setTourData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
    if (selectedStepIndex === index) {
      setSelectedStepIndex(null);
    } else if (selectedStepIndex > index) {
      setSelectedStepIndex(selectedStepIndex - 1);
    }
  };

  const handleReorderSteps = (newOrder) => {
    setTourData(prev => ({
      ...prev,
      steps: newOrder
    }));
  };

  const handleSettingsChange = (updates) => {
    setTourData(prev => ({
      ...prev,
      ...updates
    }));
  };

  const handleTargetingChange = (targeting) => {
    setTourData(prev => ({
      ...prev,
      targeting
    }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isPublishing = publishMutation.isPending;

  if (isLoading) {
    return <LoadingState title={t('tours.loading', 'Loading tour...')} fullPage />;
  }

  if (error) {
    return (
      <ErrorState
        title={t('tours.loadError', 'Failed to load tour')}
        description={error.message}
        onRetry={() => window.location.reload()}
        fullPage
      />
    );
  }

  const tabs = [
    { id: TABS.STEPS, label: t('tours.steps', 'Steps'), icon: List },
    { id: TABS.SETTINGS, label: t('tours.settings', 'Settings'), icon: Settings },
    { id: TABS.TARGETING, label: t('tours.targeting', 'Targeting'), icon: Target }
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              onClick={() => navigate('/tours')}
            >
              {t('common.back', 'Back')}
            </Button>

            <div className="h-6 w-px bg-gray-200 dark:bg-slate-700" />

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {tourData.name || t('tours.newTour', 'New Tour')}
                </h1>
                <Badge variant={tourData.status === 'active' ? 'success' : 'default'}>
                  {tourData.status}
                </Badge>
                {hasUnsavedChanges && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {t('common.unsavedChanges', 'Unsaved changes')}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tourData.steps.length} {t('tours.stepsCount', 'steps')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              icon={Eye}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? t('tours.hidePreview', 'Hide Preview') : t('tours.showPreview', 'Preview')}
            </Button>

            <Button
              variant="secondary"
              icon={Save}
              onClick={handleSave}
              loading={isSaving}
              disabled={!tourData.name}
            >
              {t('common.save', 'Save')}
            </Button>

            <Button
              variant="gradient"
              icon={Play}
              onClick={handlePublish}
              loading={isPublishing}
              disabled={!tourData.name || tourData.steps.length === 0}
            >
              {t('tours.publish', 'Publish')}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                transition-colors
                ${activeTab === tab.id
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor */}
        <div className={`flex-1 overflow-y-auto p-6 ${showPreview ? 'max-w-[60%]' : ''}`}>
          {activeTab === TABS.STEPS && (
            <div className="space-y-6">
              {/* Steps List */}
              <TourStepsList
                steps={tourData.steps}
                selectedIndex={selectedStepIndex}
                onSelect={setSelectedStepIndex}
                onAdd={handleAddStep}
                onDelete={handleDeleteStep}
                onReorder={handleReorderSteps}
              />

              {/* Step Editor */}
              {selectedStepIndex !== null && tourData.steps[selectedStepIndex] && (
                <TourStepEditor
                  step={tourData.steps[selectedStepIndex]}
                  stepNumber={selectedStepIndex + 1}
                  totalSteps={tourData.steps.length}
                  onChange={(updates) => handleUpdateStep(selectedStepIndex, updates)}
                  onClose={() => setSelectedStepIndex(null)}
                />
              )}
            </div>
          )}

          {activeTab === TABS.SETTINGS && (
            <TourSettingsForm
              name={tourData.name}
              description={tourData.description}
              settings={tourData.settings}
              trigger={tourData.trigger}
              onChange={handleSettingsChange}
            />
          )}

          {activeTab === TABS.TARGETING && (
            <TourTargetingForm
              targeting={tourData.targeting}
              onChange={handleTargetingChange}
            />
          )}
        </div>

        {/* Right Panel - Preview */}
        {showPreview && (
          <div className="w-[40%] border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <TourPreview
              steps={tourData.steps}
              settings={tourData.settings}
              currentStepIndex={selectedStepIndex || 0}
              onStepChange={setSelectedStepIndex}
            />
          </div>
        )}
      </div>
    </div>
  );
}

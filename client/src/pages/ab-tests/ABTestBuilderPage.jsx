import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Save,
  Play,
  Eye,
  Settings,
  BarChart3,
  Layers,
  ArrowLeft,
  Pause,
  CheckCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, ErrorState } from '../../components/ui/States';
import VariantEditor from '../../components/ab-tests/VariantEditor';
import TestSettingsForm from '../../components/ab-tests/TestSettingsForm';
import ABTestPreview from '../../components/ab-tests/ABTestPreview';
import ABTestStatusBadge from '../../components/ab-tests/ABTestStatusBadge';
import TrafficSplitEditor from '../../components/ab-tests/TrafficSplitEditor';
import {
  useABTestQuery,
  useCreateABTestMutation,
  useUpdateABTestMutation,
  useStartTestMutation,
  usePauseTestMutation
} from '../../hooks/ab-tests/useABTests';

const TABS = {
  VARIANTS: 'variants',
  SETTINGS: 'settings',
  RESULTS: 'results'
};

export default function ABTestBuilderPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // State
  const [activeTab, setActiveTab] = useState(TABS.VARIANTS);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Form state
  const [testData, setTestData] = useState({
    name: '',
    description: '',
    status: 'draft',
    test_type: 'message',
    goal_metric: 'conversion',
    variants: [
      {
        id: 'variant-a',
        name: 'Variant A',
        is_control: true,
        traffic_percentage: 50,
        content: {}
      },
      {
        id: 'variant-b',
        name: 'Variant B',
        is_control: false,
        traffic_percentage: 50,
        content: {}
      }
    ],
    settings: {
      auto_winner: {
        enabled: false,
        confidence_threshold: 95
      },
      schedule: {
        start_date: null,
        end_date: null
      }
    }
  });

  // Queries & Mutations
  const { data: existingTest, isLoading, error } = useABTestQuery(id, { enabled: isEditMode });
  const createMutation = useCreateABTestMutation();
  const updateMutation = useUpdateABTestMutation();
  const startMutation = useStartTestMutation();
  const pauseMutation = usePauseTestMutation();

  // Load existing test data
  useEffect(() => {
    if (existingTest) {
      setTestData(existingTest);
    }
  }, [existingTest]);

  // Track unsaved changes
  useEffect(() => {
    if (isEditMode && existingTest) {
      const hasChanges = JSON.stringify(testData) !== JSON.stringify(existingTest);
      setHasUnsavedChanges(hasChanges);
    } else if (!isEditMode && testData.name) {
      setHasUnsavedChanges(true);
    }
  }, [testData, existingTest, isEditMode]);

  // Handlers
  const handleSave = async () => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({ id, data: testData });
      } else {
        const newTest = await createMutation.mutateAsync(testData);
        navigate(`/ab-tests/${newTest.id}`, { replace: true });
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save test:', error);
    }
  };

  const handleStartTest = async () => {
    try {
      await handleSave();
      await startMutation.mutateAsync(id || testData.id);
      setTestData(prev => ({ ...prev, status: 'running' }));
    } catch (error) {
      console.error('Failed to start test:', error);
    }
  };

  const handlePauseTest = async () => {
    try {
      await pauseMutation.mutateAsync(id);
      setTestData(prev => ({ ...prev, status: 'paused' }));
    } catch (error) {
      console.error('Failed to pause test:', error);
    }
  };

  const handleAddVariant = () => {
    const variantLetter = String.fromCharCode(65 + testData.variants.length); // A, B, C...
    const newVariant = {
      id: `variant-${Date.now()}`,
      name: `Variant ${variantLetter}`,
      is_control: false,
      traffic_percentage: 0,
      content: {}
    };

    // Recalculate traffic split
    const newVariants = [...testData.variants, newVariant];
    const equalSplit = Math.floor(100 / newVariants.length);
    const remainder = 100 - (equalSplit * newVariants.length);

    const updatedVariants = newVariants.map((v, i) => ({
      ...v,
      traffic_percentage: equalSplit + (i === 0 ? remainder : 0)
    }));

    setTestData(prev => ({
      ...prev,
      variants: updatedVariants
    }));
    setSelectedVariantIndex(updatedVariants.length - 1);
  };

  const handleUpdateVariant = (index, updates) => {
    setTestData(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === index ? { ...v, ...updates } : v
      )
    }));
  };

  const handleDeleteVariant = (index) => {
    if (testData.variants.length <= 2) return; // Min 2 variants

    const newVariants = testData.variants.filter((_, i) => i !== index);

    // Recalculate traffic split
    const equalSplit = Math.floor(100 / newVariants.length);
    const remainder = 100 - (equalSplit * newVariants.length);

    const updatedVariants = newVariants.map((v, i) => ({
      ...v,
      traffic_percentage: equalSplit + (i === 0 ? remainder : 0)
    }));

    setTestData(prev => ({
      ...prev,
      variants: updatedVariants
    }));

    if (selectedVariantIndex >= updatedVariants.length) {
      setSelectedVariantIndex(updatedVariants.length - 1);
    }
  };

  const handleTrafficSplitChange = (splits) => {
    setTestData(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => ({
        ...v,
        traffic_percentage: splits[i] || 0
      }))
    }));
  };

  const handleSettingsChange = (updates) => {
    setTestData(prev => ({
      ...prev,
      ...updates
    }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isStarting = startMutation.isPending;
  const isPausing = pauseMutation.isPending;
  const isRunning = testData.status === 'running';
  const isPaused = testData.status === 'paused';
  const isCompleted = testData.status === 'completed';

  if (isLoading) {
    return <LoadingState title={t('abTests.loading', 'Loading test...')} fullPage />;
  }

  if (error) {
    return (
      <ErrorState
        title={t('abTests.loadError', 'Failed to load test')}
        description={error.message}
        onRetry={() => window.location.reload()}
        fullPage
      />
    );
  }

  const tabs = [
    { id: TABS.VARIANTS, label: t('abTests.variants', 'Variants'), icon: Layers },
    { id: TABS.SETTINGS, label: t('abTests.settings', 'Settings'), icon: Settings },
    { id: TABS.RESULTS, label: t('abTests.results', 'Results'), icon: BarChart3, disabled: testData.status === 'draft' }
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
              onClick={() => navigate('/ab-tests')}
            >
              {t('common.back', 'Back')}
            </Button>

            <div className="h-6 w-px bg-gray-200 dark:bg-slate-700" />

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {testData.name || t('abTests.newTest', 'New A/B Test')}
                </h1>
                <ABTestStatusBadge status={testData.status} />
                {hasUnsavedChanges && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {t('common.unsavedChanges', 'Unsaved changes')}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {testData.variants.length} {t('abTests.variantsCount', 'variants')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              icon={Eye}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? t('abTests.hidePreview', 'Hide Preview') : t('abTests.showPreview', 'Preview')}
            </Button>

            <Button
              variant="secondary"
              icon={Save}
              onClick={handleSave}
              loading={isSaving}
              disabled={!testData.name || isCompleted}
            >
              {t('common.save', 'Save')}
            </Button>

            {isRunning ? (
              <Button
                variant="warning"
                icon={Pause}
                onClick={handlePauseTest}
                loading={isPausing}
              >
                {t('abTests.pause', 'Pause Test')}
              </Button>
            ) : !isCompleted && (
              <Button
                variant="success"
                icon={Play}
                onClick={handleStartTest}
                loading={isStarting}
                disabled={!testData.name || testData.variants.length < 2}
              >
                {isPaused ? t('abTests.resume', 'Resume Test') : t('abTests.startTest', 'Start Test')}
              </Button>
            )}

            {isCompleted && (
              <Button
                variant="primary"
                icon={BarChart3}
                onClick={() => navigate(`/ab-tests/${id}/results`)}
              >
                {t('abTests.viewResults', 'View Results')}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                transition-colors
                ${tab.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : activeTab === tab.id
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
          {activeTab === TABS.VARIANTS && (
            <div className="space-y-6">
              {/* Traffic Split */}
              <TrafficSplitEditor
                variants={testData.variants}
                onChange={handleTrafficSplitChange}
                disabled={isRunning || isCompleted}
              />

              {/* Variants */}
              <Card>
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {t('abTests.testVariants', 'Test Variants')}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddVariant}
                    disabled={testData.variants.length >= 4 || isRunning || isCompleted}
                  >
                    {t('abTests.addVariant', 'Add Variant')}
                  </Button>
                </div>

                {/* Variant Tabs */}
                <div className="flex border-b border-gray-200 dark:border-slate-700">
                  {testData.variants.map((variant, index) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariantIndex(index)}
                      className={`
                        px-4 py-3 text-sm font-medium border-b-2 transition-colors
                        ${selectedVariantIndex === index
                          ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }
                      `}
                    >
                      {variant.name}
                      {variant.is_control && (
                        <Badge size="sm" variant="default" className="ml-2">
                          Control
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>

                {/* Variant Editor */}
                {testData.variants[selectedVariantIndex] && (
                  <VariantEditor
                    variant={testData.variants[selectedVariantIndex]}
                    testType={testData.test_type}
                    onChange={(updates) => handleUpdateVariant(selectedVariantIndex, updates)}
                    onDelete={() => handleDeleteVariant(selectedVariantIndex)}
                    canDelete={testData.variants.length > 2}
                    disabled={isRunning || isCompleted}
                  />
                )}
              </Card>
            </div>
          )}

          {activeTab === TABS.SETTINGS && (
            <TestSettingsForm
              name={testData.name}
              description={testData.description}
              testType={testData.test_type}
              goalMetric={testData.goal_metric}
              settings={testData.settings}
              onChange={handleSettingsChange}
              disabled={isRunning || isCompleted}
            />
          )}

          {activeTab === TABS.RESULTS && (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                {t('abTests.resultsTab', 'Test Results')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('abTests.viewDetailedResults', 'View detailed results and analytics for this test.')}
              </p>
              <Button onClick={() => navigate(`/ab-tests/${id}/results`)}>
                {t('abTests.goToResults', 'Go to Results Page')}
              </Button>
            </div>
          )}
        </div>

        {/* Right Panel - Preview */}
        {showPreview && (
          <div className="w-[40%] border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <ABTestPreview
              testType={testData.test_type}
              variants={testData.variants}
              selectedVariantIndex={selectedVariantIndex}
              onVariantChange={setSelectedVariantIndex}
            />
          </div>
        )}
      </div>
    </div>
  );
}

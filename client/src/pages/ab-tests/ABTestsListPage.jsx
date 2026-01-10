import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  FlaskConical,
  Filter,
  Calendar
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState, CardSkeleton } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import ABTestCard from '../../components/ab-tests/ABTestCard';
import {
  useABTestsQuery,
  useDeleteABTestMutation,
  useDuplicateABTestMutation,
  useStartTestMutation,
  usePauseTestMutation,
  useCompleteTestMutation
} from '../../hooks/ab-tests/useABTests';

export default function ABTestsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [deleteModal, setDeleteModal] = useState({ open: false, test: null });

  // Queries & Mutations
  const { data, isLoading, error, refetch } = useABTestsQuery();
  const tests = data?.tests || data || [];
  const deleteMutation = useDeleteABTestMutation();
  const duplicateMutation = useDuplicateABTestMutation();
  const startMutation = useStartTestMutation();
  const pauseMutation = usePauseTestMutation();
  const completeMutation = useCompleteTestMutation();

  // Filter and sort tests
  const filteredTests = useMemo(() => {
    let result = [...tests];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(test =>
        test.name?.toLowerCase().includes(query) ||
        test.description?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(test => test.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(test => test.test_type === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'created_at') {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === 'conversion_rate') {
        return (b.conversion_rate || 0) - (a.conversion_rate || 0);
      }
      return 0;
    });

    return result;
  }, [tests, searchQuery, statusFilter, typeFilter, sortBy]);

  // Handlers
  const handleDelete = async () => {
    if (deleteModal.test) {
      await deleteMutation.mutateAsync(deleteModal.test.id);
      setDeleteModal({ open: false, test: null });
    }
  };

  const handleDuplicate = async (test) => {
    await duplicateMutation.mutateAsync(test.id);
  };

  const handleStart = async (test) => {
    await startMutation.mutateAsync(test.id);
  };

  const handlePause = async (test) => {
    await pauseMutation.mutateAsync(test.id);
  };

  const handleComplete = async (test) => {
    await completeMutation.mutateAsync(test.id);
  };

  // Options
  const statusOptions = [
    { value: 'all', label: t('abTests.allStatuses', 'All Statuses') },
    { value: 'draft', label: t('abTests.draft', 'Draft') },
    { value: 'running', label: t('abTests.running', 'Running') },
    { value: 'paused', label: t('abTests.paused', 'Paused') },
    { value: 'completed', label: t('abTests.completed', 'Completed') }
  ];

  const typeOptions = [
    { value: 'all', label: t('abTests.allTypes', 'All Types') },
    { value: 'message', label: t('abTests.typeMessage', 'Message') },
    { value: 'button', label: t('abTests.typeButton', 'Button') },
    { value: 'widget', label: t('abTests.typeWidget', 'Widget') },
    { value: 'welcome', label: t('abTests.typeWelcome', 'Welcome') },
    { value: 'flow', label: t('abTests.typeFlow', 'Flow') },
    { value: 'tour', label: t('abTests.typeTour', 'Tour') }
  ];

  const sortOptions = [
    { value: 'created_at', label: t('abTests.sortNewest', 'Newest First') },
    { value: 'name', label: t('abTests.sortName', 'Name A-Z') },
    { value: 'conversion_rate', label: t('abTests.sortConversion', 'Conversion Rate') }
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FlaskConical className="w-7 h-7 text-purple-600" />
            {t('abTests.title', 'A/B Testing')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('abTests.subtitle', 'Create and manage A/B tests to optimize your bot performance')}
          </p>
        </div>

        <Button
          icon={Plus}
          onClick={() => navigate('/ab-tests/new')}
          className="shrink-0"
        >
          {t('abTests.createTest', 'New Test')}
        </Button>
      </div>

      {/* Filters */}
      <Card size="sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder={t('abTests.searchPlaceholder', 'Search tests...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
              clearable
              onClear={() => setSearchQuery('')}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
              className="w-36"
            />

            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={typeOptions}
              className="w-36"
            />

            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              options={sortOptions}
              className="w-44"
            />
          </div>
        </div>
      </Card>

      {/* Tests Grid */}
      {filteredTests.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={tests.length === 0
            ? t('abTests.emptyTitle', 'No A/B tests yet')
            : t('abTests.noResults', 'No tests found')
          }
          description={tests.length === 0
            ? t('abTests.emptyDescription', 'Create your first A/B test to start optimizing your bot.')
            : t('abTests.noResultsDescription', 'Try adjusting your search or filter criteria.')
          }
          action={tests.length === 0 && (
            <Button icon={Plus} onClick={() => navigate('/ab-tests/new')}>
              {t('abTests.createFirstTest', 'Create Your First Test')}
            </Button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTests.map(test => (
            <ABTestCard
              key={test.id}
              test={test}
              onEdit={() => navigate(`/ab-tests/${test.id}`)}
              onDuplicate={() => handleDuplicate(test)}
              onDelete={() => setDeleteModal({ open: true, test })}
              onStart={() => handleStart(test)}
              onPause={() => handlePause(test)}
              onComplete={() => handleComplete(test)}
              onViewResults={() => navigate(`/ab-tests/${test.id}/results`)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, test: null })}
        onConfirm={handleDelete}
        title={t('abTests.deleteTitle', 'Delete Test')}
        description={t('abTests.deleteDescription', `Are you sure you want to delete "${deleteModal.test?.name}"? This action cannot be undone.`)}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

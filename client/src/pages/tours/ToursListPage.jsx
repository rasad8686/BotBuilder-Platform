import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  Play,
  Pause,
  Archive,
  Eye,
  BarChart3,
  Map,
  Compass
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState, LoadingState, CardSkeleton } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import TourCard from '../../components/tours/TourCard';
import {
  useToursQuery,
  useDeleteTourMutation,
  useDuplicateTourMutation,
  usePublishTourMutation,
  usePauseTourMutation
} from '../../hooks/useTours';

export default function ToursListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [viewMode, setViewMode] = useState('grid'); // grid or table
  const [deleteModal, setDeleteModal] = useState({ open: false, tour: null });

  // Queries & Mutations
  const { data, isLoading, error, refetch } = useToursQuery();
  const tours = data?.tours || [];
  const deleteMutation = useDeleteTourMutation();
  const duplicateMutation = useDuplicateTourMutation();
  const publishMutation = usePublishTourMutation();
  const pauseMutation = usePauseTourMutation();

  // Filter and sort tours
  const filteredTours = useMemo(() => {
    let result = [...tours];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(tour =>
        tour.name?.toLowerCase().includes(query) ||
        tour.description?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(tour => tour.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'created_at') {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === 'updated_at') {
        return new Date(b.updated_at) - new Date(a.updated_at);
      }
      return 0;
    });

    return result;
  }, [tours, searchQuery, statusFilter, sortBy]);

  // Handlers
  const handleDelete = async () => {
    if (deleteModal.tour) {
      await deleteMutation.mutateAsync(deleteModal.tour.id);
      setDeleteModal({ open: false, tour: null });
    }
  };

  const handleDuplicate = async (tour) => {
    await duplicateMutation.mutateAsync(tour.id);
  };

  const handlePublish = async (tour) => {
    await publishMutation.mutateAsync(tour.id);
  };

  const handlePause = async (tour) => {
    await pauseMutation.mutateAsync(tour.id);
  };

  // Status options
  const statusOptions = [
    { value: 'all', label: t('tours.allStatuses', 'All Statuses') },
    { value: 'draft', label: t('tours.draft', 'Draft') },
    { value: 'active', label: t('tours.active', 'Active') },
    { value: 'paused', label: t('tours.paused', 'Paused') },
    { value: 'archived', label: t('tours.archived', 'Archived') }
  ];

  const sortOptions = [
    { value: 'created_at', label: t('tours.sortNewest', 'Newest First') },
    { value: 'updated_at', label: t('tours.sortUpdated', 'Recently Updated') },
    { value: 'name', label: t('tours.sortName', 'Name A-Z') }
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
            <CardSkeleton key={i} lines={2} />
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
            <Compass className="w-7 h-7 text-purple-600" />
            {t('tours.title', 'Product Tours')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('tours.subtitle', 'Create and manage interactive product tours for your users')}
          </p>
        </div>

        <Button
          icon={Plus}
          onClick={() => navigate('/tours/new')}
          className="shrink-0"
        >
          {t('tours.createTour', 'New Tour')}
        </Button>
      </div>

      {/* Filters */}
      <Card size="sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder={t('tours.searchPlaceholder', 'Search tours...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
              clearable
              onClear={() => setSearchQuery('')}
            />
          </div>

          <div className="flex gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
              className="w-40"
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

      {/* Tours Grid/List */}
      {filteredTours.length === 0 ? (
        <EmptyState
          icon={Map}
          title={tours.length === 0
            ? t('tours.emptyTitle', 'No tours yet')
            : t('tours.noResults', 'No tours found')
          }
          description={tours.length === 0
            ? t('tours.emptyDescription', 'Create your first product tour to guide users through your application.')
            : t('tours.noResultsDescription', 'Try adjusting your search or filter criteria.')
          }
          action={tours.length === 0 && (
            <Button icon={Plus} onClick={() => navigate('/tours/new')}>
              {t('tours.createFirstTour', 'Create Your First Tour')}
            </Button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTours.map(tour => (
            <TourCard
              key={tour.id}
              tour={tour}
              onEdit={() => navigate(`/tours/${tour.id}`)}
              onDuplicate={() => handleDuplicate(tour)}
              onDelete={() => setDeleteModal({ open: true, tour })}
              onPublish={() => handlePublish(tour)}
              onPause={() => handlePause(tour)}
              onViewAnalytics={() => navigate(`/tours/${tour.id}/analytics`)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, tour: null })}
        onConfirm={handleDelete}
        title={t('tours.deleteTitle', 'Delete Tour')}
        description={t('tours.deleteDescription', `Are you sure you want to delete "${deleteModal.tour?.name}"? This action cannot be undone.`)}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

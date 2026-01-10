import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Filter,
  Ticket,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Trash2,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, LoadingState, CardSkeleton } from '../../components/ui/States';
import { ConfirmModal } from '../../components/ui/Modal';
import TicketCard from '../../components/tickets/TicketCard';
import TicketStatusBadge from '../../components/tickets/TicketStatusBadge';
import TicketPriorityBadge from '../../components/tickets/TicketPriorityBadge';
import TicketFilters from '../../components/tickets/TicketFilters';
import BulkActionsBar from '../../components/tickets/BulkActionsBar';
import TicketStatsCards from '../../components/tickets/dashboard/TicketStatsCards';
import {
  useTicketsQuery,
  useDeleteTicketMutation,
  useBulkActionMutation
} from '../../hooks/tickets/useTickets';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' }
];

export default function TicketsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    priority: 'all',
    assignee: 'all',
    category: 'all',
    dateRange: null
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ open: false, ticket: null });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Queries & Mutations
  const { data, isLoading, error, refetch } = useTicketsQuery({
    status: activeTab !== 'all' ? activeTab : undefined,
    priority: filters.priority !== 'all' ? filters.priority : undefined,
    assignee: filters.assignee !== 'all' ? filters.assignee : undefined,
    category: filters.category !== 'all' ? filters.category : undefined,
    search: searchQuery || undefined,
    sortBy,
    sortOrder,
    page,
    pageSize
  });

  const tickets = data?.tickets || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };
  const stats = data?.stats || {};

  const deleteMutation = useDeleteTicketMutation();
  const bulkMutation = useBulkActionMutation();

  // Handlers
  const handleDelete = async () => {
    if (deleteModal.ticket) {
      await deleteMutation.mutateAsync(deleteModal.ticket.id);
      setDeleteModal({ open: false, ticket: null });
    }
  };

  const handleSelectTicket = (ticketId) => {
    setSelectedTickets(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTickets.length === tickets.length) {
      setSelectedTickets([]);
    } else {
      setSelectedTickets(tickets.map(t => t.id));
    }
  };

  const handleBulkAction = async (action, data) => {
    await bulkMutation.mutateAsync({
      ticketIds: selectedTickets,
      action,
      ...data
    });
    setSelectedTickets([]);
  };

  const handleClearFilters = () => {
    setFilters({
      priority: 'all',
      assignee: 'all',
      category: 'all',
      dateRange: null
    });
    setSearchQuery('');
  };

  // Options
  const priorityOptions = [
    { value: 'all', label: t('tickets.allPriorities', 'All Priorities') },
    { value: 'low', label: t('tickets.priorityLow', 'Low') },
    { value: 'medium', label: t('tickets.priorityMedium', 'Medium') },
    { value: 'high', label: t('tickets.priorityHigh', 'High') },
    { value: 'urgent', label: t('tickets.priorityUrgent', 'Urgent') }
  ];

  const assigneeOptions = [
    { value: 'all', label: t('tickets.allAssignees', 'All Assignees') },
    { value: 'me', label: t('tickets.assignedToMe', 'Assigned to Me') },
    { value: 'unassigned', label: t('tickets.unassigned', 'Unassigned') }
  ];

  const sortOptions = [
    { value: 'created_at', label: t('tickets.sortCreated', 'Created Date') },
    { value: 'updated_at', label: t('tickets.sortUpdated', 'Updated Date') },
    { value: 'priority', label: t('tickets.sortPriority', 'Priority') },
    { value: 'due_date', label: t('tickets.sortDueDate', 'Due Date') }
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
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
            <Ticket className="w-7 h-7 text-purple-600" />
            {t('tickets.title', 'Helpdesk Tickets')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('tickets.subtitle', 'Manage and respond to customer support tickets')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={() => refetch()}
          >
            {t('common.refresh', 'Refresh')}
          </Button>
          <Button
            icon={Plus}
            onClick={() => navigate('/tickets/new')}
          >
            {t('tickets.createTicket', 'New Ticket')}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <TicketStatsCards
        openCount={stats.open || 0}
        pendingCount={stats.pending || 0}
        breachedCount={stats.breached || 0}
        resolvedToday={stats.resolvedToday || 0}
      />

      {/* Status Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`
              px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            {t(`tickets.status${tab.label}`, tab.label)}
            {tab.id !== 'all' && stats[tab.id] !== undefined && (
              <Badge
                variant={tab.id === 'open' ? 'primary' : 'secondary'}
                size="sm"
                className="ml-2"
              >
                {stats[tab.id]}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card size="sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder={t('tickets.searchPlaceholder', 'Search by ticket #, subject, or email...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
              clearable
              onClear={() => setSearchQuery('')}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              options={priorityOptions}
              className="w-36"
            />

            <Select
              value={filters.assignee}
              onChange={(e) => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
              options={assigneeOptions}
              className="w-40"
            />

            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              options={sortOptions}
              className="w-36"
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        <TicketFilters
          filters={filters}
          searchQuery={searchQuery}
          onClearFilters={handleClearFilters}
        />
      </Card>

      {/* Bulk Actions Bar */}
      {selectedTickets.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedTickets.length}
          onClearSelection={() => setSelectedTickets([])}
          onBulkAction={handleBulkAction}
          loading={bulkMutation.isPending}
        />
      )}

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={searchQuery || Object.values(filters).some(v => v !== 'all' && v !== null)
            ? t('tickets.noResults', 'No tickets found')
            : t('tickets.emptyTitle', 'No tickets yet')
          }
          description={searchQuery || Object.values(filters).some(v => v !== 'all' && v !== null)
            ? t('tickets.noResultsDescription', 'Try adjusting your search or filter criteria.')
            : t('tickets.emptyDescription', 'Create your first support ticket to get started.')
          }
          action={!searchQuery && (
            <Button icon={Plus} onClick={() => navigate('/tickets/new')}>
              {t('tickets.createFirstTicket', 'Create First Ticket')}
            </Button>
          )}
        />
      ) : (
        <div className="space-y-3">
          {/* Select All Header */}
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
            <input
              type="checkbox"
              checked={selectedTickets.length === tickets.length && tickets.length > 0}
              onChange={handleSelectAll}
              className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedTickets.length > 0
                ? t('tickets.selectedCount', '{{count}} selected', { count: selectedTickets.length })
                : t('tickets.selectAll', 'Select all')
              }
            </span>
          </div>

          {/* Ticket Cards */}
          {tickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              selected={selectedTickets.includes(ticket.id)}
              onSelect={() => handleSelectTicket(ticket.id)}
              onClick={() => navigate(`/tickets/${ticket.id}`)}
              onDelete={() => setDeleteModal({ open: true, ticket })}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('tickets.showingResults', 'Showing {{from}}-{{to}} of {{total}} tickets', {
              from: (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, pagination.total),
              total: pagination.total
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              {t('common.previous', 'Previous')}
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('common.pageOf', 'Page {{page}} of {{total}}', { page, total: pagination.pages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => Math.min(pagination.pages, prev + 1))}
              disabled={page === pagination.pages}
            >
              {t('common.next', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, ticket: null })}
        onConfirm={handleDelete}
        title={t('tickets.deleteTitle', 'Delete Ticket')}
        description={t('tickets.deleteDescription', `Are you sure you want to delete ticket #${deleteModal.ticket?.ticket_number}? This action cannot be undone.`)}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

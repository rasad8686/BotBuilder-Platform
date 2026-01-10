import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export default function TicketFilters({
  filters,
  searchQuery,
  onClearFilters
}) {
  const { t } = useTranslation();

  const activeFilters = [];

  if (searchQuery) {
    activeFilters.push({
      key: 'search',
      label: t('tickets.search', 'Search'),
      value: searchQuery
    });
  }

  if (filters.priority && filters.priority !== 'all') {
    activeFilters.push({
      key: 'priority',
      label: t('tickets.priority', 'Priority'),
      value: filters.priority
    });
  }

  if (filters.assignee && filters.assignee !== 'all') {
    activeFilters.push({
      key: 'assignee',
      label: t('tickets.assignee', 'Assignee'),
      value: filters.assignee === 'me'
        ? t('tickets.assignedToMe', 'Me')
        : filters.assignee === 'unassigned'
          ? t('tickets.unassigned', 'Unassigned')
          : filters.assignee
    });
  }

  if (filters.category && filters.category !== 'all') {
    activeFilters.push({
      key: 'category',
      label: t('tickets.category', 'Category'),
      value: filters.category
    });
  }

  if (filters.dateRange) {
    activeFilters.push({
      key: 'dateRange',
      label: t('tickets.dateRange', 'Date Range'),
      value: filters.dateRange
    });
  }

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {t('tickets.activeFilters', 'Active filters:')}
      </span>
      <div className="flex flex-wrap gap-2">
        {activeFilters.map(filter => (
          <Badge
            key={filter.key}
            variant="secondary"
            className="flex items-center gap-1"
          >
            <span className="text-xs text-gray-500 dark:text-gray-400">{filter.label}:</span>
            <span>{filter.value}</span>
          </Badge>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearFilters}
        className="text-red-500 hover:text-red-600"
      >
        <X className="w-4 h-4 mr-1" />
        {t('tickets.clearAll', 'Clear all')}
      </Button>
    </div>
  );
}

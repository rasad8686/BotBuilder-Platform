/**
 * TourMetricsTable Component
 * Sortable table showing tour metrics with pagination and export
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';

/**
 * Format time duration
 */
const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
};

/**
 * Get status badge variant
 */
const getStatusVariant = (status) => {
  const variants = {
    active: 'success',
    paused: 'warning',
    draft: 'default',
    archived: 'error'
  };
  return variants[status] || 'default';
};

/**
 * TourMetricsTable Component
 * @param {Object} props
 * @param {Array} props.tours - Tour data array
 * @param {number} props.pageSize - Items per page (default: 10)
 * @param {Function} props.onExport - Export callback
 * @param {Function} props.onTourClick - Tour row click callback
 * @param {boolean} props.isLoading - Loading state
 */
export default function TourMetricsTable({
  tours = [],
  pageSize = 10,
  onExport,
  onTourClick,
  isLoading = false
}) {
  const { t } = useTranslation();

  // State
  const [sortConfig, setSortConfig] = useState({ key: 'impressions', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);

  // Column definitions
  const columns = [
    { key: 'name', label: t('analytics.tourName', 'Tour Name'), sortable: true },
    { key: 'status', label: t('analytics.status', 'Status'), sortable: true },
    { key: 'impressions', label: t('analytics.impressions', 'Impressions'), sortable: true, numeric: true },
    { key: 'starts', label: t('analytics.starts', 'Starts'), sortable: true, numeric: true },
    { key: 'completions', label: t('analytics.completions', 'Completions'), sortable: true, numeric: true },
    { key: 'completion_rate', label: t('analytics.rate', 'Rate'), sortable: true, numeric: true },
    { key: 'avgTime', label: t('analytics.avgTime', 'Avg Time'), sortable: true, numeric: true }
  ];

  // Sort handler
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  }, []);

  // Sorted data
  const sortedData = useMemo(() => {
    if (!tours || tours.length === 0) return [];

    const sorted = [...tours].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = aVal - bVal;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [tours, sortConfig]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Pagination info
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, sortedData.length);

  // Export handler
  const handleExport = useCallback(() => {
    if (onExport) {
      onExport(sortedData);
    } else {
      // Default CSV export
      const headers = columns.map(c => c.label).join(',');
      const rows = sortedData.map(tour =>
        columns.map(col => {
          const val = tour[col.key];
          if (col.key === 'completion_rate') return `${val || 0}%`;
          if (col.key === 'avgTime') return formatTime(val);
          return typeof val === 'string' ? `"${val}"` : val;
        }).join(',')
      ).join('\n');

      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tour-metrics-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [sortedData, columns, onExport]);

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded mb-2" />
        ))}
      </div>
    );
  }

  // Empty state
  if (sortedData.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-slate-800 rounded-lg">
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400">
          {t('analytics.noTourData', 'No tour data available')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          icon={Download}
          onClick={handleExport}
        >
          {t('analytics.exportCSV', 'Export CSV')}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700' : ''
                  } ${column.numeric ? 'text-right' : ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className={`flex items-center gap-1 ${column.numeric ? 'justify-end' : ''}`}>
                    {column.label}
                    {column.sortable && sortConfig.key === column.key && (
                      sortConfig.direction === 'asc'
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {paginatedData.map((tour, index) => (
              <tr
                key={tour.id || index}
                className={`bg-white dark:bg-slate-900 ${
                  onTourClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800' : ''
                }`}
                onClick={() => onTourClick && onTourClick(tour)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                    {tour.name || 'Unnamed Tour'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getStatusVariant(tour.status)}>
                    {tour.status || 'draft'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                  {(tour.impressions || 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                  {(tour.starts || 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                  {(tour.completions || 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-medium ${
                    (tour.completion_rate || 0) >= 50
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {tour.completion_rate || 0}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                  {formatTime(tour.avgTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('analytics.showing', 'Showing')} {startItem}-{endItem} {t('analytics.of', 'of')} {sortedData.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              {t('common.prev', 'Prev')}
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              iconRight={ChevronRight}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              {t('common.next', 'Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

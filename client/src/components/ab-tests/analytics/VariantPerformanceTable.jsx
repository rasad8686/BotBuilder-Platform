/**
 * VariantPerformanceTable Component
 * Detailed sortable table with variant metrics
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Variant colors
const VARIANT_COLORS = {
  A: 'bg-blue-500',
  B: 'bg-green-500',
  C: 'bg-amber-500',
  D: 'bg-purple-500',
  E: 'bg-pink-500',
  F: 'bg-teal-500'
};

/**
 * Status badge component
 */
function StatusBadge({ status, isWinner }) {
  if (isWinner) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
        <Trophy className="w-3 h-3" />
        Winner
      </span>
    );
  }

  const statusConfig = {
    leading: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-400',
      icon: TrendingUp,
      label: 'Leading'
    },
    control: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      icon: Minus,
      label: 'Control'
    },
    underperforming: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      icon: TrendingDown,
      label: 'Underperforming'
    }
  };

  const config = statusConfig[status] || statusConfig.control;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 ${config.bg} ${config.text} text-xs font-medium rounded-full`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

/**
 * Sortable header cell
 */
function SortableHeader({ label, sortKey, currentSort, onSort }) {
  const isActive = currentSort.key === sortKey;
  const Icon = isActive
    ? (currentSort.direction === 'asc' ? ArrowUp : ArrowDown)
    : ArrowUpDown;

  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : ''}`} />
      </div>
    </th>
  );
}

/**
 * VariantPerformanceTable Component
 * @param {Object} props
 * @param {Array} props.variants - Variant data
 * @param {string} props.winnerVariant - Winner variant name
 * @param {Function} props.onExport - Export callback
 */
export default function VariantPerformanceTable({
  variants = [],
  winnerVariant = null,
  onExport
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState({ key: 'conversionRate', direction: 'desc' });

  // Handle sort
  const handleSort = (key) => {
    setSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Process and sort data
  const sortedVariants = useMemo(() => {
    if (!variants || variants.length === 0) return [];

    // Find control variant for lift calculation
    const controlVariant = variants.find(v => v.isControl);
    const controlRate = controlVariant
      ? (controlVariant.conversions / controlVariant.impressions) * 100
      : 0;

    const processed = variants.map(variant => {
      const impressions = variant.impressions || 0;
      const conversions = variant.conversions || 0;
      const conversionRate = impressions > 0 ? (conversions / impressions) * 100 : 0;
      const lift = controlRate > 0 ? ((conversionRate - controlRate) / controlRate) * 100 : 0;
      const confidence = variant.confidence || 0;

      // Determine status
      let status = 'control';
      if (variant.isControl) {
        status = 'control';
      } else if (lift > 0) {
        status = 'leading';
      } else if (lift < 0) {
        status = 'underperforming';
      }

      return {
        ...variant,
        name: variant.name || variant.variantName,
        impressions,
        conversions,
        conversionRate,
        lift: variant.isControl ? 0 : lift,
        confidence,
        status
      };
    });

    // Sort
    return [...processed].sort((a, b) => {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      const modifier = sort.direction === 'asc' ? 1 : -1;

      if (typeof aVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      return (aVal - bVal) * modifier;
    });
  }, [variants, sort]);

  // Export to CSV
  const handleExport = () => {
    if (onExport) {
      onExport(sortedVariants);
      return;
    }

    // Default CSV export
    const headers = ['Variant', 'Impressions', 'Conversions', 'Conversion Rate', 'Lift vs Control', 'Confidence', 'Status'];
    const rows = sortedVariants.map(v => [
      v.name,
      v.impressions,
      v.conversions,
      `${v.conversionRate.toFixed(2)}%`,
      `${v.lift >= 0 ? '+' : ''}${v.lift.toFixed(2)}%`,
      `${v.confidence.toFixed(1)}%`,
      v.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ab-test-variants.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Empty state
  if (sortedVariants.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          {t('abTests.noVariantData', 'No variant data available')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t('abTests.variantPerformance', 'Variant Performance')}
        </h3>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          {t('common.exportCSV', 'Export CSV')}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr>
              <SortableHeader
                label={t('abTests.variant', 'Variant')}
                sortKey="name"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHeader
                label={t('abTests.impressions', 'Impressions')}
                sortKey="impressions"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHeader
                label={t('abTests.conversions', 'Conversions')}
                sortKey="conversions"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHeader
                label={t('abTests.conversionRate', 'Conv. Rate')}
                sortKey="conversionRate"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHeader
                label={t('abTests.liftVsControl', 'Lift vs Control')}
                sortKey="lift"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHeader
                label={t('abTests.confidence', 'Confidence')}
                sortKey="confidence"
                currentSort={sort}
                onSort={handleSort}
              />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('abTests.status', 'Status')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {sortedVariants.map((variant) => {
              const isWinner = winnerVariant === variant.name;
              const rowBg = isWinner
                ? 'bg-amber-50 dark:bg-amber-900/10'
                : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50';

              return (
                <tr key={variant.name} className={rowBg}>
                  {/* Variant name */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${VARIANT_COLORS[variant.name] || 'bg-gray-500'}`} />
                      <span className="font-medium text-gray-900 dark:text-white">
                        Variant {variant.name}
                      </span>
                      {variant.isControl && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          (Control)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Impressions */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {variant.impressions.toLocaleString()}
                  </td>

                  {/* Conversions */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {variant.conversions.toLocaleString()}
                  </td>

                  {/* Conversion Rate */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {variant.conversionRate.toFixed(2)}%
                    </span>
                  </td>

                  {/* Lift vs Control */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {variant.isControl ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <span className={`font-medium ${
                        variant.lift > 0
                          ? 'text-green-600 dark:text-green-400'
                          : variant.lift < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500'
                      }`}>
                        {variant.lift >= 0 && '+'}
                        {variant.lift.toFixed(2)}%
                      </span>
                    )}
                  </td>

                  {/* Confidence */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            variant.confidence >= 95
                              ? 'bg-green-500'
                              : variant.confidence >= 90
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(variant.confidence, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {variant.confidence.toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <StatusBadge status={variant.status} isWinner={isWinner} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

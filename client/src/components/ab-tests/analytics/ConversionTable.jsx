import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Badge } from '../../ui/Badge';

export default function ConversionTable({ variants, goalMetric }) {
  const { t } = useTranslation();

  const sortedVariants = useMemo(() => {
    return [...variants].sort((a, b) => b.conversion_rate - a.conversion_rate);
  }, [variants]);

  const control = useMemo(() => {
    return variants.find(v => v.is_control);
  }, [variants]);

  const leader = sortedVariants[0];

  const getMetricLabel = (metric) => {
    const labels = {
      conversion: t('abTests.conversionRate', 'Conversion Rate'),
      engagement: t('abTests.engagementRate', 'Engagement Rate'),
      clicks: t('abTests.ctr', 'Click-through Rate'),
      completion: t('abTests.completionRate', 'Completion Rate'),
      revenue: t('abTests.revenuePerVisitor', 'Revenue per Visitor'),
      time_on_page: t('abTests.avgTimeOnPage', 'Avg. Time on Page')
    };
    return labels[metric] || metric;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('abTests.variant', 'Variant')}
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('abTests.visitors', 'Visitors')}
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('abTests.conversions', 'Conversions')}
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              {getMetricLabel(goalMetric)}
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('abTests.vsControl', 'vs Control')}
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('abTests.revenue', 'Revenue')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedVariants.map((variant, idx) => {
            const isLeader = variant.id === leader?.id;
            const isControlVariant = variant.is_control;

            let improvement = 0;
            if (control && !isControlVariant) {
              improvement = ((variant.conversion_rate - control.conversion_rate) / (control.conversion_rate || 1)) * 100;
            }

            const isPositive = improvement > 0;
            const isNeutral = Math.abs(improvement) < 1;

            return (
              <tr
                key={variant.id}
                className={`
                  border-b border-gray-100 dark:border-slate-800
                  ${isLeader ? 'bg-green-50 dark:bg-green-900/10' : ''}
                  hover:bg-gray-50 dark:hover:bg-slate-800/50
                `}
              >
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {variant.name}
                    </span>
                    {isControlVariant && (
                      <Badge variant="secondary" size="sm">
                        {t('abTests.control', 'Control')}
                      </Badge>
                    )}
                    {isLeader && !isControlVariant && (
                      <Badge variant="success" size="sm">
                        <Trophy className="w-3 h-3 mr-1" />
                        {t('abTests.leader', 'Leader')}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">
                  {variant.visitors?.toLocaleString() || 0}
                </td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">
                  {variant.conversions?.toLocaleString() || 0}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {variant.conversion_rate?.toFixed(2) || '0.00'}%
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  {isControlVariant ? (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  ) : (
                    <div className={`
                      inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium
                      ${isNeutral
                        ? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400'
                        : isPositive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }
                    `}>
                      {isNeutral ? (
                        <Minus className="w-3 h-3" />
                      ) : isPositive ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {isNeutral ? '~0%' : `${isPositive ? '+' : ''}${improvement.toFixed(1)}%`}
                    </div>
                  )}
                </td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">
                  ${variant.revenue?.toFixed(2) || '0.00'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-slate-800/50">
            <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
              {t('abTests.total', 'Total')}
            </td>
            <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
              {variants.reduce((sum, v) => sum + (v.visitors || 0), 0).toLocaleString()}
            </td>
            <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
              {variants.reduce((sum, v) => sum + (v.conversions || 0), 0).toLocaleString()}
            </td>
            <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
              {(variants.reduce((sum, v) => sum + (v.conversions || 0), 0) /
                (variants.reduce((sum, v) => sum + (v.visitors || 0), 0) || 1) * 100).toFixed(2)}%
            </td>
            <td className="py-3 px-4"></td>
            <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
              ${variants.reduce((sum, v) => sum + (v.revenue || 0), 0).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

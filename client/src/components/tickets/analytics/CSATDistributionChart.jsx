/**
 * CSAT Distribution Chart Component
 * Horizontal stacked bar showing 1-5 star breakdown
 */

import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';

const RATING_COLORS = {
  5: '#10B981', // green
  4: '#22C55E', // light green
  3: '#F59E0B', // amber
  2: '#F97316', // orange
  1: '#EF4444'  // red
};

export default function CSATDistributionChart({ data, isLoading }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="h-6 w-40 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-20 h-4 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="flex-1 h-6 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const distribution = data || [];
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  const renderStars = (rating) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('tickets.analytics.ratingDistribution', 'Rating Distribution')}
      </h3>

      {distribution.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          {t('tickets.analytics.noRatings', 'No ratings yet')}
        </div>
      ) : (
        <div className="space-y-3">
          {distribution.map((item) => (
            <div key={item.rating} className="flex items-center gap-3">
              <div className="w-20 flex items-center gap-1">
                {renderStars(item.rating)}
              </div>
              <div className="flex-1 h-6 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    backgroundColor: RATING_COLORS[item.rating]
                  }}
                />
              </div>
              <div className="w-24 text-right">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.percentage}%
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  ({item.count})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

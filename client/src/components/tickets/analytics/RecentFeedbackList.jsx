/**
 * Recent Feedback List Component
 * List of recent customer feedback
 */

import { useTranslation } from 'react-i18next';
import { Star, MessageSquare, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function RecentFeedbackList({ data, isLoading, onTicketClick }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="h-6 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-12 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const feedback = data || [];

  const renderStars = (rating) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20';
    if (rating >= 3) return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20';
    return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('tickets.analytics.recentFeedback', 'Recent Feedback')}
        </h3>
        <MessageSquare className="w-5 h-5 text-gray-400" />
      </div>

      {feedback.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {t('tickets.analytics.noFeedback', 'No feedback yet')}
        </div>
      ) : (
        <div className="space-y-4">
          {feedback.map((item, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getRatingColor(item.rating)} transition-all hover:shadow-sm`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {renderStars(item.rating)}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.date && formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                  </span>
                </div>
                {item.ticketNumber && (
                  <button
                    onClick={() => onTicketClick && onTicketClick(item.ticketId)}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {item.ticketNumber}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                {item.feedback || t('tickets.analytics.noComment', 'No comment provided')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

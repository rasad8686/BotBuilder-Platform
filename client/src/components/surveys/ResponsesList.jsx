import React from 'react';
import {
  User,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Star,
  MessageSquare
} from 'lucide-react';

const ResponsesList = ({ responses, survey, selectedId, onSelect }) => {
  const getCategoryBadge = (category) => {
    const styles = {
      promoter: 'bg-green-100 text-green-700',
      passive: 'bg-yellow-100 text-yellow-700',
      detractor: 'bg-red-100 text-red-700'
    };

    const icons = {
      promoter: ThumbsUp,
      passive: null,
      detractor: ThumbsDown
    };

    const Icon = icons[category];

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[category] || 'bg-gray-100 text-gray-700'}`}>
        {Icon && <Icon className="w-3 h-3" />}
        {category?.charAt(0).toUpperCase() + category?.slice(1)}
      </span>
    );
  };

  const formatDate = (date) => {
    const now = new Date();
    const responseDate = new Date(date);
    const diffMs = now - responseDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return responseDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getTextPreview = (response) => {
    // Find first text answer
    const textAnswer = response.answers.find(a => typeof a.value === 'string' && a.value.length > 0);
    return textAnswer?.value || null;
  };

  if (responses.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No responses found</p>
        <p className="text-sm text-gray-400">Responses will appear here as they come in</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {responses.map((response) => {
          const textPreview = getTextPreview(response);
          const isSelected = selectedId === response.id;

          return (
            <button
              key={response.id}
              onClick={() => onSelect(response)}
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {response.respondent?.avatar ? (
                    <img
                      src={response.respondent.avatar}
                      alt={response.respondent.name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {response.respondent?.name || 'Anonymous'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {response.respondent?.email || 'No email'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {survey?.type === 'nps' && response.category && (
                    getCategoryBadge(response.category)
                  )}
                  {survey?.type === 'rating' && response.score && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                      <span className="font-medium">{response.score}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Score for NPS */}
              {survey?.type === 'nps' && response.score !== undefined && (
                <div className="mb-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                    <span className="text-sm font-semibold text-gray-700">
                      Score: {response.score}/10
                    </span>
                  </div>
                </div>
              )}

              {/* Text preview */}
              {textPreview && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                  "{textPreview}"
                </p>
              )}

              {/* Timestamp */}
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {formatDate(response.submitted_at)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ResponsesList;

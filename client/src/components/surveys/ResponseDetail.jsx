import React from 'react';
import {
  X,
  User,
  Clock,
  Mail,
  ThumbsUp,
  ThumbsDown,
  Star,
  Calendar,
  Globe,
  Smartphone
} from 'lucide-react';

const ResponseDetail = ({ response, survey, onClose }) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryInfo = (category) => {
    const info = {
      promoter: {
        label: 'Promoter',
        description: 'Likely to recommend',
        color: 'bg-green-100 text-green-700',
        icon: ThumbsUp
      },
      passive: {
        label: 'Passive',
        description: 'Satisfied but not enthusiastic',
        color: 'bg-yellow-100 text-yellow-700',
        icon: null
      },
      detractor: {
        label: 'Detractor',
        description: 'Unlikely to recommend',
        color: 'bg-red-100 text-red-700',
        icon: ThumbsDown
      }
    };
    return info[category] || { label: category, color: 'bg-gray-100 text-gray-700' };
  };

  const renderAnswerValue = (answer, question) => {
    if (answer.value === undefined || answer.value === null) {
      return <span className="text-gray-400">No answer</span>;
    }

    const questionType = question?.type;

    switch (questionType) {
      case 'nps':
        const npsCategory = answer.value >= 9 ? 'promoter' : answer.value >= 7 ? 'passive' : 'detractor';
        const categoryInfo = getCategoryInfo(npsCategory);
        const CategoryIcon = categoryInfo.icon;
        return (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-gray-900">{answer.value}</span>
              <span className="text-gray-400">/10</span>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}>
              {CategoryIcon && <CategoryIcon className="w-3 h-3" />}
              {categoryInfo.label}
            </span>
          </div>
        );

      case 'rating':
        return (
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-6 h-6 ${i < answer.value ? 'text-orange-500 fill-orange-500' : 'text-gray-200'}`}
              />
            ))}
            <span className="ml-2 text-lg font-medium text-gray-700">{answer.value}/5</span>
          </div>
        );

      case 'emoji':
        const emojis = ['very_unsatisfied', 'unsatisfied', 'neutral', 'satisfied', 'very_satisfied'];
        const emojiIcons = ['very_unsatisfied', 'unsatisfied', 'neutral', 'satisfied', 'very_satisfied'];
        const emojiLabels = ['Very Unsatisfied', 'Unsatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'];
        const emojiIndex = emojis.indexOf(answer.value);
        return (
          <div className="flex items-center gap-2">
            <span className="text-2xl">{emojiIcons[emojiIndex] || answer.value}</span>
            <span className="text-gray-700">{emojiLabels[emojiIndex] || answer.value}</span>
          </div>
        );

      case 'scale':
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${((answer.value - (question.min || 1)) / ((question.max || 10) - (question.min || 1))) * 100}%` }}
              />
            </div>
            <span className="font-medium text-gray-700">{answer.value}</span>
          </div>
        );

      case 'single_choice':
      case 'multiple_choice':
        const values = Array.isArray(answer.value) ? answer.value : [answer.value];
        return (
          <div className="flex flex-wrap gap-2">
            {values.map((v, i) => (
              <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                {v}
              </span>
            ))}
          </div>
        );

      case 'text':
        return (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700 whitespace-pre-wrap">{answer.value || '-'}</p>
          </div>
        );

      default:
        return <span className="text-gray-700">{String(answer.value)}</span>;
    }
  };

  const getQuestionById = (questionId) => {
    return survey?.questions?.find(q => q.id === questionId);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-6">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Response Details</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Respondent Info */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          {response.respondent?.avatar ? (
            <img
              src={response.respondent.avatar}
              alt={response.respondent.name}
              className="w-14 h-14 rounded-full"
            />
          ) : (
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-7 h-7 text-gray-400" />
            </div>
          )}
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-lg">
              {response.respondent?.name || 'Anonymous'}
            </p>
            {response.respondent?.email && (
              <div className="flex items-center gap-1 text-gray-500 text-sm">
                <Mail className="w-4 h-4" />
                {response.respondent.email}
              </div>
            )}
          </div>
        </div>

        {/* Meta Info */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(response.submitted_at)}</span>
          </div>
          {response.metadata?.browser && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Globe className="w-4 h-4" />
              <span>{response.metadata.browser}</span>
            </div>
          )}
          {response.metadata?.device && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Smartphone className="w-4 h-4" />
              <span>{response.metadata.device}</span>
            </div>
          )}
        </div>
      </div>

      {/* Answers */}
      <div className="px-6 py-4 space-y-6 max-h-[400px] overflow-y-auto">
        {response.answers.map((answer, index) => {
          const question = getQuestionById(answer.question_id);
          return (
            <div key={index}>
              <p className="text-sm font-medium text-gray-500 mb-2">
                Q{index + 1}. {question?.title || 'Question'}
              </p>
              {renderAnswerValue(answer, question)}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Response ID: {response.id}
          </span>
          <button className="text-sm text-blue-600 hover:text-blue-700">
            Export Response
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResponseDetail;

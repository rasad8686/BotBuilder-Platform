import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Edit2,
  MessageSquare,
  BarChart3,
  Copy,
  Trash2,
  Play,
  Pause,
  Clock,
  Users,
  Star,
  ThumbsUp
} from 'lucide-react';

const SurveyCard = ({
  survey,
  onEdit,
  onViewResponses,
  onViewAnalytics,
  onDuplicate,
  onDelete
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState('bottom');
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuPosition(spaceBelow < 200 ? 'top' : 'bottom');
    }
  }, [showMenu]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      draft: 'bg-gray-100 text-gray-700',
      paused: 'bg-yellow-100 text-yellow-700',
      archived: 'bg-red-100 text-red-700'
    };

    const icons = {
      active: Play,
      draft: Edit2,
      paused: Pause,
      archived: Clock
    };

    const Icon = icons[status] || Clock;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const styles = {
      nps: 'bg-purple-100 text-purple-700',
      feedback: 'bg-blue-100 text-blue-700',
      rating: 'bg-orange-100 text-orange-700',
      exit: 'bg-red-100 text-red-700'
    };

    const labels = {
      nps: 'NPS',
      feedback: 'Feedback',
      rating: 'Rating',
      exit: 'Exit Survey'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[type] || 'bg-gray-100 text-gray-700'}`}>
        {labels[type] || type}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getScoreDisplay = () => {
    if (survey.type === 'nps' && survey.avg_score !== null) {
      return (
        <div className="flex items-center gap-1">
          <ThumbsUp className="w-4 h-4 text-purple-500" />
          <span className="font-medium">{survey.avg_score.toFixed(1)}</span>
        </div>
      );
    }
    if (survey.type === 'rating' && survey.avg_score !== null) {
      return (
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
          <span className="font-medium">{survey.avg_score.toFixed(1)}/5</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getTypeBadge(survey.type)}
          {getStatusBadge(survey.status)}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            ref={buttonRef}
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className={`absolute right-0 z-50 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 ${
              menuPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}>
              <button
                onClick={() => { onEdit(); setShowMenu(false); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => { onViewResponses(); setShowMenu(false); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                View Responses
              </button>
              <button
                onClick={() => { onViewAnalytics(); setShowMenu(false); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
              <button
                onClick={() => { onDuplicate(); setShowMenu(false); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </button>
              <hr className="my-1" />
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{survey.name}</h3>
      <p className="text-sm text-gray-500 line-clamp-2 mb-4">{survey.description}</p>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-gray-500">
            <Users className="w-4 h-4" />
            <span>{survey.response_count}</span>
          </div>
          {getScoreDisplay()}
        </div>
        <span className="text-xs text-gray-400">
          Updated {formatDate(survey.updated_at)}
        </span>
      </div>
    </div>
  );
};

export default SurveyCard;

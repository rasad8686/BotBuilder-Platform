import { useState, useEffect } from 'react';
import {
  Shield,
  Bot,
  Users,
  Settings,
  LogIn,
  LogOut,
  UserPlus,
  Trash2,
  Edit,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { getActivityTimeline } from '../api/admin';

/**
 * ActivityTimeline Component
 * Displays a visual timeline of recent activities with auto-refresh
 */
const ActivityTimeline = ({ days = 7, limit = 20, autoRefresh = true }) => {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTimeline = async () => {
    try {
      setError(null);
      const response = await getActivityTimeline({ days, limit });
      setTimeline(response.timeline || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activity timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();

    // Auto-refresh every 30 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchTimeline();
      }, 30000);

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, limit, autoRefresh]);

  // Get icon for action type
  const getActionIcon = (action) => {
    if (action.includes('login')) return LogIn;
    if (action.includes('logout')) return LogOut;
    if (action.includes('register')) return UserPlus;
    if (action.includes('bot')) return Bot;
    if (action.includes('organization') || action.includes('member')) return Users;
    if (action.includes('deleted')) return Trash2;
    if (action.includes('updated')) return Edit;
    if (action.includes('switched')) return RefreshCw;
    if (action.includes('security') || action.includes('failed')) return AlertCircle;
    return Settings;
  };

  // Get color for action type
  const getActionColor = (action) => {
    if (action.includes('failed') || action.includes('deleted')) {
      return { bg: 'bg-red-100', icon: 'text-red-600', border: 'border-red-200' };
    }
    if (action.includes('created') || action.includes('register') || action.includes('login.success')) {
      return { bg: 'bg-green-100', icon: 'text-green-600', border: 'border-green-200' };
    }
    if (action.includes('updated') || action.includes('changed')) {
      return { bg: 'bg-orange-100', icon: 'text-orange-600', border: 'border-orange-200' };
    }
    if (action.includes('security') || action.includes('unauthorized')) {
      return { bg: 'bg-red-100', icon: 'text-red-600', border: 'border-red-200' };
    }
    return { bg: 'bg-blue-100', icon: 'text-blue-600', border: 'border-blue-200' };
  };

  // Format action name
  const formatAction = (action) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\./g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchTimeline}
            className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No activity in the last {days} days</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        {autoRefresh && (
          <span className="text-xs text-gray-500">Auto-refreshing...</span>
        )}
      </div>

      <div className="space-y-4">
        {timeline.map((event, index) => {
          const Icon = getActionIcon(event.action);
          const colors = getActionColor(event.action);

          return (
            <div key={event.id} className="flex items-start gap-3 relative">
              {/* Timeline line */}
              {index < timeline.length - 1 && (
                <div className="absolute left-5 top-10 w-0.5 h-full bg-gray-200"></div>
              )}

              {/* Icon */}
              <div className={`w-10 h-10 ${colors.bg} rounded-full flex items-center justify-center border-2 ${colors.border} relative z-10`}>
                <Icon className={`w-5 h-5 ${colors.icon}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatAction(event.action)}
                    </p>
                    {event.user_name && (
                      <p className="text-sm text-gray-600 truncate">
                        by {event.user_name}
                      </p>
                    )}
                    {event.resource_type && (
                      <p className="text-xs text-gray-500 mt-1">
                        {event.resource_type} {event.resource_id ? `#${event.resource_id}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatTimeAgo(event.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityTimeline;

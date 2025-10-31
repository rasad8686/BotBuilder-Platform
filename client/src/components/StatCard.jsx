import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * StatCard Component
 * Displays a metric with icon, value, and optional trend
 */
const StatCard = ({
  title,
  value,
  icon: Icon,
  trend = null,
  trendLabel = '',
  color = 'indigo',
  loading = false
}) => {
  // Color classes mapping
  const colorClasses = {
    indigo: {
      bg: 'bg-indigo-50',
      icon: 'text-indigo-600',
      accent: 'bg-indigo-600'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      accent: 'bg-green-600'
    },
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      accent: 'bg-blue-600'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      accent: 'bg-purple-600'
    },
    orange: {
      bg: 'bg-orange-50',
      icon: 'text-orange-600',
      accent: 'bg-orange-600'
    },
    red: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      accent: 'bg-red-600'
    }
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  const getTrendIcon = () => {
    if (trend === null || trend === 0) return <Minus className="w-4 h-4" />;
    if (trend > 0) return <TrendingUp className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (trend === null || trend === 0) return 'text-gray-500';
    if (trend > 0) return 'text-green-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className={`w-12 h-12 ${colors.bg} rounded-lg`}></div>
          </div>
          <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {Icon && (
          <div className={`${colors.bg} p-3 rounded-lg`}>
            <Icon className={`w-6 h-6 ${colors.icon}`} />
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900">{value}</p>

          {trend !== null && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="font-medium">
                {trend > 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && (
                <span className="text-gray-500 ml-1">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;

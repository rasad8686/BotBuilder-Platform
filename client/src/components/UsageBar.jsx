export default function UsageBar({ used, limit, label, color = 'purple' }) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  const colorClasses = {
    purple: {
      bg: 'bg-purple-200',
      fill: 'bg-purple-600',
      text: 'text-purple-900'
    },
    blue: {
      bg: 'bg-blue-200',
      fill: 'bg-blue-600',
      text: 'text-blue-900'
    },
    green: {
      bg: 'bg-green-200',
      fill: 'bg-green-600',
      text: 'text-green-900'
    },
    red: {
      bg: 'bg-red-200',
      fill: 'bg-red-600',
      text: 'text-red-900'
    },
    yellow: {
      bg: 'bg-yellow-200',
      fill: 'bg-yellow-600',
      text: 'text-yellow-900'
    }
  };

  const colors = colorClasses[color] || colorClasses.purple;

  // Determine status color based on percentage
  let statusColor = colors;
  if (percentage >= 90) {
    statusColor = colorClasses.red;
  } else if (percentage >= 75) {
    statusColor = colorClasses.yellow;
  }

  return (
    <div className="mb-4">
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-sm font-semibold ${statusColor.text}`}>
            {used} / {limit === -1 ? '∞' : limit}
          </span>
        </div>
      )}

      <div className={`w-full ${statusColor.bg} rounded-full h-3 overflow-hidden`}>
        <div
          className={`${statusColor.fill} h-3 rounded-full transition-all duration-300 ease-in-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {percentage >= 90 && limit !== -1 && (
        <p className="text-xs text-red-600 mt-1 font-medium">
          ⚠️ Approaching limit - consider upgrading
        </p>
      )}
    </div>
  );
}

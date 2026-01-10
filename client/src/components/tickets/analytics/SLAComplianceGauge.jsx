/**
 * SLA Compliance Gauge Component
 * Circular gauge showing SLA compliance percentage
 */

import { useTranslation } from 'react-i18next';

export default function SLAComplianceGauge({ value = 0, target = 95, title, size = 'md' }) {
  const { t } = useTranslation();

  const sizeConfig = {
    sm: { width: 100, strokeWidth: 8, fontSize: 'text-lg' },
    md: { width: 140, strokeWidth: 10, fontSize: 'text-2xl' },
    lg: { width: 180, strokeWidth: 12, fontSize: 'text-3xl' }
  };

  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const targetOffset = circumference - (target / 100) * circumference;

  const getColor = (val) => {
    if (val >= 95) return '#10B981'; // green
    if (val >= 85) return '#F59E0B'; // amber
    return '#EF4444'; // red
  };

  const color = getColor(value);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg
          className="transform -rotate-90"
          width={config.width}
          height={config.width}
        >
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            className="dark:stroke-slate-700"
            strokeWidth={config.strokeWidth}
          />

          {/* Target line */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke="#D1D5DB"
            strokeWidth={2}
            strokeDasharray={circumference}
            strokeDashoffset={targetOffset}
            strokeLinecap="round"
            className="dark:stroke-slate-600"
          />

          {/* Value circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out'
            }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${config.fontSize} font-bold text-gray-900 dark:text-white`}>
            {value}%
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tickets.analytics.target', 'Target')}: {target}%
          </span>
        </div>
      </div>

      {title && (
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </p>
      )}
    </div>
  );
}

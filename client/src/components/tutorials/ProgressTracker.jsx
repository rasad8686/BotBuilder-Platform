import React from 'react';

export default function ProgressTracker({ completed, total, size = 'md', showCertificate = false }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = completed === total && total > 0;

  const sizeClasses = {
    sm: {
      container: 'w-16 h-16',
      circle: 48,
      strokeWidth: 4,
      textSize: 'text-sm',
      labelSize: 'text-xs'
    },
    md: {
      container: 'w-24 h-24',
      circle: 72,
      strokeWidth: 6,
      textSize: 'text-xl',
      labelSize: 'text-sm'
    },
    lg: {
      container: 'w-32 h-32',
      circle: 96,
      strokeWidth: 8,
      textSize: 'text-2xl',
      labelSize: 'text-base'
    }
  };

  const config = sizeClasses[size];
  const radius = (config.circle - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      {/* Circular Progress */}
      <div className={`relative ${config.container}`}>
        <svg className="w-full h-full transform -rotate-90">
          {/* Background Circle */}
          <circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-gray-200 dark:text-slate-700"
          />
          {/* Progress Circle */}
          <circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Percentage Text */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isComplete ? (
            <div className="text-green-500">
              <svg className={`${size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-8 h-8' : 'w-10 h-10'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          ) : (
            <span className={`font-bold text-gray-800 dark:text-white ${config.textSize}`}>
              {percentage}%
            </span>
          )}
        </div>
      </div>

      {/* Text Info */}
      <div>
        <p className={`font-semibold text-gray-800 dark:text-white ${config.labelSize}`}>
          {completed} / {total} tamamlandı
        </p>
        {isComplete ? (
          <p className="text-green-500 text-sm font-medium mt-1">
            Bütün videolar tamamlandı!
          </p>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {total - completed} video qaldı
          </p>
        )}

        {/* Certificate Badge */}
        {showCertificate && isComplete && (
          <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Sertifikat
          </div>
        )}
      </div>
    </div>
  );
}

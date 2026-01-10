import React from 'react';
import { Link } from 'react-router-dom';
import ProgressTracker from './ProgressTracker';

const categoryLabels = {
  'getting-started': 'Başlanğıc',
  'channels': 'Kanallar',
  'ai-features': 'AI Features',
  'advanced': 'Advanced'
};

export default function TutorialSidebar({
  tutorials,
  currentTutorialId,
  completedTutorials = [],
  onClose
}) {
  // Group tutorials by category
  const groupedTutorials = tutorials.reduce((acc, tutorial) => {
    const category = tutorial.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tutorial);
    return acc;
  }, {});

  // Find current tutorial index
  const currentIndex = tutorials.findIndex(t => t.id === currentTutorialId);
  const nextTutorial = currentIndex < tutorials.length - 1 ? tutorials[currentIndex + 1] : null;
  const prevTutorial = currentIndex > 0 ? tutorials[currentIndex - 1] : null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="font-bold text-gray-800 dark:text-white">Kurs Planı</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <ProgressTracker
          completed={completedTutorials.length}
          total={tutorials.length}
          size="sm"
        />
      </div>

      {/* Course Outline */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groupedTutorials).map(([category, categoryTutorials]) => (
          <div key={category} className="mb-4">
            <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {categoryLabels[category] || category}
            </h3>
            <ul className="space-y-1">
              {categoryTutorials.map((tutorial) => {
                const isActive = tutorial.id === currentTutorialId;
                const isCompleted = completedTutorials.includes(tutorial.id);

                return (
                  <li key={tutorial.id}>
                    <Link
                      to={`/academy/${tutorial.id}`}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
                        ${isActive
                          ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                        }
                      `}
                    >
                      {/* Status Icon */}
                      <div className={`
                        w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium
                        ${isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-400'
                        }
                      `}>
                        {isCompleted ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                          </svg>
                        ) : isActive ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        ) : (
                          tutorial.id
                        )}
                      </div>

                      {/* Title & Duration */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-purple-700 dark:text-purple-300' : ''}`}>
                          {tutorial.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {tutorial.duration}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-2">
        {prevTutorial && (
          <Link
            to={`/academy/${prevTutorial.id}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Əvvəlki
          </Link>
        )}
        {nextTutorial && (
          <Link
            to={`/academy/${nextTutorial.id}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Növbəti Video
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}

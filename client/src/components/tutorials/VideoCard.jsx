import React from 'react';
import { Link } from 'react-router-dom';

const difficultyColors = {
  Beginner: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  Advanced: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
};

const categoryColors = {
  'getting-started': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'channels': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  'ai-features': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  'advanced': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
};

const categoryLabels = {
  'getting-started': 'Başlanğıc',
  'channels': 'Kanallar',
  'ai-features': 'AI Features',
  'advanced': 'Advanced'
};

export default function VideoCard({ tutorial, isCompleted, onClick }) {
  const { id, title, category, duration, difficulty, description, thumbnail } = tutorial;

  return (
    <Link
      to={`/academy/${id}`}
      onClick={onClick}
      className="group block bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video bg-gradient-to-br from-purple-600 to-indigo-700 overflow-hidden">
        {/* Thumbnail Image or Placeholder */}
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-20 h-20 text-white/30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
            <svg className="w-8 h-8 text-purple-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-2 py-1 rounded">
          {duration}
        </div>

        {/* Completed Checkmark */}
        {isCompleted && (
          <div className="absolute top-2 right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Tags */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[category] || 'bg-gray-100 text-gray-700'}`}>
            {categoryLabels[category] || category}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColors[difficulty]}`}>
            {difficulty}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-800 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
          {description}
        </p>
      </div>
    </Link>
  );
}

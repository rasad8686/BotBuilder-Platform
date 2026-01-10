import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const difficultyColors = {
  Beginner: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  Advanced: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
};

export default function VideoPlayer({ tutorial, isCompleted, onMarkComplete, relatedTutorials = [] }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const { title, youtubeId, description, duration, difficulty, category } = tutorial;

  return (
    <div className="space-y-6">
      {/* Video Container */}
      <div className="bg-black rounded-xl overflow-hidden shadow-xl">
        <div className="relative aspect-video">
          {youtubeId && youtubeId !== 'placeholder' ? (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
              title={title}
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
              <div className="text-center text-white">
                <svg className="w-24 h-24 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <p className="text-lg font-medium opacity-75">Video tezliklə əlavə olunacaq</p>
                <p className="text-sm opacity-50 mt-1">Coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              {title}
            </h1>
            <div className="flex items-center gap-3 text-sm">
              <span className={`font-medium px-3 py-1 rounded-full ${difficultyColors[difficulty]}`}>
                {difficulty}
              </span>
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {duration}
              </span>
            </div>
          </div>

          {/* Mark Complete Button */}
          <button
            onClick={onMarkComplete}
            className={`
              px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2
              ${isCompleted
                ? 'bg-green-500 text-white cursor-default'
                : 'bg-purple-600 hover:bg-purple-700 text-white hover:shadow-lg transform hover:scale-105'
              }
            `}
            disabled={isCompleted}
          >
            {isCompleted ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                Tamamlandı
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Tamamlandı Kimi İşarələ
              </>
            )}
          </button>
        </div>

        {/* Description */}
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Transcript Toggle */}
        <div className="mt-6 border-t border-gray-200 dark:border-slate-700 pt-4">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${showTranscript ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
            Transkript {showTranscript ? 'Gizlət' : 'Göstər'}
          </button>

          {showTranscript && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Transkript tezliklə əlavə olunacaq...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Related Videos */}
      {relatedTutorials.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
            Əlaqəli Videolar
          </h2>
          <div className="space-y-3">
            {relatedTutorials.map((related) => (
              <Link
                key={related.id}
                to={`/academy/${related.id}`}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group"
              >
                {/* Mini Thumbnail */}
                <div className="relative w-32 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-700">
                  {related.thumbnail ? (
                    <img src={related.thumbnail} alt={related.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                    {related.duration}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
                    {related.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {related.difficulty}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

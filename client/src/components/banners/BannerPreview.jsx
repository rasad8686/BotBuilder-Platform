import React from 'react';
import { X, ExternalLink } from 'lucide-react';

/**
 * BannerPreview Component
 * Shows a preview of how the banner will look
 */
export default function BannerPreview({ banner, className = '' }) {
  // Default type colors
  const typeColors = {
    info: { bg: 'bg-blue-500', text: 'text-white' },
    warning: { bg: 'bg-amber-500', text: 'text-white' },
    success: { bg: 'bg-emerald-500', text: 'text-white' },
    error: { bg: 'bg-red-500', text: 'text-white' },
    promo: { bg: 'bg-purple-500', text: 'text-white' }
  };

  const defaultColors = typeColors[banner?.type] || typeColors.info;

  // Use custom colors if provided, otherwise use type defaults
  const bgStyle = banner?.background_color
    ? { backgroundColor: banner.background_color }
    : {};
  const textStyle = banner?.text_color
    ? { color: banner.text_color }
    : {};

  const bgClass = banner?.background_color ? '' : defaultColors.bg;
  const textClass = banner?.text_color ? '' : defaultColors.text;

  if (!banner?.title && !banner?.message) {
    return (
      <div className={`p-4 bg-gray-100 dark:bg-slate-800 rounded-lg text-center text-gray-500 dark:text-gray-400 ${className}`}>
        Banner preview will appear here
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-between px-4 py-3 rounded-lg ${bgClass} ${textClass} ${className}`}
      style={{ ...bgStyle, ...textStyle }}
    >
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1">
          {banner?.title && (
            <span className="font-semibold mr-2">{banner.title}</span>
          )}
          {banner?.message && (
            <span className="opacity-90">{banner.message}</span>
          )}
          {banner?.link_url && banner?.link_text && (
            <a
              href={banner.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 ml-2 underline hover:no-underline font-medium"
              onClick={(e) => e.preventDefault()}
            >
              {banner.link_text}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
      {banner?.is_dismissible !== false && (
        <button
          className="ml-4 p-1 rounded-full hover:bg-white/20 transition-colors"
          onClick={(e) => e.preventDefault()}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

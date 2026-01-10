import React from 'react';
import { ExternalLink, MousePointer } from 'lucide-react';

const ClickMapWidget = ({ links = [], totalClicks = 0 }) => {
  // Sort links by clicks
  const sortedLinks = [...links].sort((a, b) => b.clicks - a.clicks);
  const topLinks = sortedLinks.slice(0, 5);

  const truncateUrl = (url, maxLength = 50) => {
    if (!url) return '';
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  const getPercentage = (clicks) => {
    if (!totalClicks) return 0;
    return ((clicks / totalClicks) * 100).toFixed(1);
  };

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <MousePointer className="w-8 h-8 mb-2" />
        <p className="text-sm">No link clicks recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topLinks.map((link, index) => (
        <div key={index} className="group">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                {index + 1}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-700 hover:text-blue-600 truncate flex items-center gap-1"
                title={link.url}
              >
                {truncateUrl(link.url)}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
            <div className="text-right ml-3">
              <span className="text-sm font-medium text-gray-900">{link.clicks}</span>
              <span className="text-xs text-gray-400 ml-1">({getPercentage(link.clicks)}%)</span>
            </div>
          </div>
          <div className="ml-8">
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(parseFloat(getPercentage(link.clicks)), 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}

      {links.length > 5 && (
        <p className="text-xs text-gray-400 text-center pt-2">
          +{links.length - 5} more links
        </p>
      )}

      <div className="pt-3 mt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Total Clicks</span>
          <span className="font-medium text-gray-900">{totalClicks.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-gray-500">Unique Links</span>
          <span className="font-medium text-gray-900">{links.length}</span>
        </div>
      </div>
    </div>
  );
};

export default ClickMapWidget;

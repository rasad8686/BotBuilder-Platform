import React from 'react';
import { Globe, MapPin } from 'lucide-react';

const LocationMapWidget = ({ locations = [] }) => {
  // Sort locations by opens
  const sortedLocations = [...locations].sort((a, b) => b.opens - a.opens);
  const topLocations = sortedLocations.slice(0, 10);

  const totalOpens = locations.reduce((sum, loc) => sum + loc.opens, 0);

  const getPercentage = (opens) => {
    if (!totalOpens) return 0;
    return ((opens / totalOpens) * 100).toFixed(1);
  };

  // Country flag emoji (simplified - could use a proper flag library)
  const getCountryFlag = (countryCode) => {
    const flags = {
      US: '🇺🇸',
      GB: '🇬🇧',
      CA: '🇨🇦',
      AU: '🇦🇺',
      DE: '🇩🇪',
      FR: '🇫🇷',
      IN: '🇮🇳',
      BR: '🇧🇷',
      JP: '🇯🇵',
      AZ: '🇦🇿',
      TR: '🇹🇷',
      RU: '🇷🇺',
      ES: '🇪🇸',
      IT: '🇮🇹',
      NL: '🇳🇱'
    };
    return flags[countryCode] || '🌍';
  };

  if (locations.length === 0) {
    // Show sample data
    const sampleLocations = [
      { country: 'United States', country_code: 'US', opens: 2450 },
      { country: 'United Kingdom', country_code: 'GB', opens: 890 },
      { country: 'Germany', country_code: 'DE', opens: 654 },
      { country: 'France', country_code: 'FR', opens: 432 },
      { country: 'Canada', country_code: 'CA', opens: 321 }
    ];
    return <LocationMapWidget locations={sampleLocations} />;
  }

  return (
    <div>
      {/* Simple World Map Representation */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg viewBox="0 0 100 50" className="w-full h-full">
            {/* Simplified world map dots */}
            <circle cx="25" cy="20" r="1.5" fill="#6366F1" />
            <circle cx="45" cy="18" r="1.5" fill="#6366F1" />
            <circle cx="48" cy="22" r="1.5" fill="#6366F1" />
            <circle cx="70" cy="25" r="1.5" fill="#6366F1" />
            <circle cx="80" cy="35" r="1.5" fill="#6366F1" />
          </svg>
        </div>
        <div className="relative flex items-center justify-center gap-4">
          <Globe className="w-12 h-12 text-blue-500" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{locations.length}</p>
            <p className="text-sm text-gray-500">Countries</p>
          </div>
          <div className="border-l border-gray-200 pl-4">
            <p className="text-2xl font-bold text-gray-900">{totalOpens.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Opens</p>
          </div>
        </div>
      </div>

      {/* Top Countries List */}
      <div className="space-y-2">
        {topLocations.map((location, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
          >
            <span className="text-xl">{getCountryFlag(location.country_code)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {location.country}
                </span>
                <span className="text-sm text-gray-500">
                  {location.opens.toLocaleString()} ({getPercentage(location.opens)}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(parseFloat(getPercentage(location.opens)), 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {locations.length > 10 && (
        <p className="text-xs text-gray-400 text-center mt-2">
          +{locations.length - 10} more countries
        </p>
      )}
    </div>
  );
};

export default LocationMapWidget;

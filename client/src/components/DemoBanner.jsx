import React from 'react';
import { Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Demo Mode Banner
 * Displays at the top of the page when viewing demo account
 * Shows restrictions and provides exit option
 */
function DemoBanner() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = React.useState(true);

  const exitDemo = () => {
    // Clear demo flag and user data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isDemo');

    // Redirect to home page
    navigate('/');
  };

  // Check if user is in demo mode
  const isDemo = localStorage.getItem('isDemo') === 'true';

  if (!isDemo || !isVisible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Info className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm md:text-base">
                You are viewing a demo account
              </p>
              <p className="text-xs md:text-sm opacity-90">
                This is a read-only preview with sample data. Some features are limited.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exitDemo}
              className="hidden md:block bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50 transition text-sm"
            >
              Exit Demo
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 hover:bg-orange-600 rounded transition"
              aria-label="Close banner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Exit Button */}
        <button
          onClick={exitDemo}
          className="md:hidden mt-2 w-full bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50 transition text-sm"
        >
          Exit Demo
        </button>
      </div>
    </div>
  );
}

export default DemoBanner;

import { useState, useEffect } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useNavigate } from 'react-router-dom';

export default function OrganizationSwitcher() {
  const {
    organizations,
    currentOrganization,
    userRole,
    switchOrganization,
    loading,
    isAuthenticated
  } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // ESC key handler to close dropdown
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Show loading state
  if (loading) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 animate-pulse">
        <div className="h-12 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Don't render if no organizations
  if (!currentOrganization || organizations.length === 0) {
    return null;
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'member':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner':
        return '👑';
      case 'admin':
        return '🛡️';
      case 'member':
        return '✏️';
      case 'viewer':
        return '👁️';
      default:
        return '👤';
    }
  };

  return (
    <div className="relative px-4 py-3 border-b border-gray-200">
      {/* Current Organization Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Current organization: ${currentOrganization.name}. Click to switch organizations`}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg hover:from-purple-100 hover:to-blue-100 transition-all duration-200 border border-purple-200"
      >
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏢</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900 truncate" title={currentOrganization.name}>
                {currentOrganization.name}
              </div>
              <div className="text-xs text-gray-600 truncate" title={currentOrganization.slug}>
                {currentOrganization.slug}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded border ${getRoleBadgeColor(userRole)}`}
          >
            {getRoleIcon(userRole)} {userRole?.toUpperCase()}
          </span>
          <span className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-4 right-4 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-2 z-20 max-h-96 overflow-y-auto" role="menu">
            {/* Organizations List */}
            <div className="px-2 py-1">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 py-2">
                Your Organizations
              </div>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    if (org.id !== currentOrganization.id) {
                      switchOrganization(org.id);
                    }
                    setIsOpen(false);
                  }}
                  role="menuitem"
                  className={`
                    w-full px-3 py-2 rounded-lg text-left flex items-center justify-between
                    transition-colors duration-150
                    ${org.id === currentOrganization.id
                      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base">🏢</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate dark:text-gray-200" title={org.name}>{org.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={org.slug}>{org.slug}</div>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-2 py-1 rounded border flex-shrink-0 ${getRoleBadgeColor(org.role)}`}
                  >
                    {getRoleIcon(org.role)} {org.role?.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-slate-700 my-2"></div>

            {/* Settings Link */}
            {(userRole === 'owner' || userRole === 'admin') && (
              <button
                onClick={() => {
                  navigate('/organizations/settings');
                  setIsOpen(false);
                }}
                className="w-full px-5 py-2 text-left flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400 transition-colors"
                role="menuitem"
              >
                <span>⚙️</span>
                <span className="font-medium text-sm">Organization Settings</span>
              </button>
            )}

            {/* Create Organization */}
            <button
              onClick={() => {
                navigate('/organizations');
                setIsOpen(false);
              }}
              className="w-full px-5 py-2 text-left flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 transition-colors"
              role="menuitem"
            >
              <span>➕</span>
              <span className="font-medium text-sm">Create New Organization</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

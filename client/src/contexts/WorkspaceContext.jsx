import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');

  // Fetch all workspaces
  const fetchWorkspaces = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/workspaces`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const fetchedWorkspaces = data.workspaces || [];
        setWorkspaces(fetchedWorkspaces);

        // Set default workspace if none selected
        if (!currentWorkspace && fetchedWorkspaces.length > 0) {
          const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
          const savedWorkspace = savedWorkspaceId
            ? fetchedWorkspaces.find(w => w.id === parseInt(savedWorkspaceId))
            : null;

          const defaultWorkspace = savedWorkspace
            || fetchedWorkspaces.find(w => w.isDefault)
            || fetchedWorkspaces[0];

          setCurrentWorkspace(defaultWorkspace);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [token, currentWorkspace]);

  // Switch to a different workspace
  const switchWorkspace = useCallback((workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('currentWorkspaceId', workspace.id.toString());

    // Dispatch event for components that need to refresh
    window.dispatchEvent(new CustomEvent('workspaceChanged', { detail: workspace }));
  }, []);

  // Get workspace filter params for API calls
  const getWorkspaceParams = useCallback(() => {
    if (!currentWorkspace) return {};
    return { workspace_id: currentWorkspace.id };
  }, [currentWorkspace]);

  // Get workspace header for API calls
  const getWorkspaceHeaders = useCallback(() => {
    if (!currentWorkspace) return {};
    return { 'X-Workspace-Id': currentWorkspace.id.toString() };
  }, [currentWorkspace]);

  // Check if user can perform action in current workspace
  const canPerformAction = useCallback((requiredRole) => {
    if (!currentWorkspace) return false;

    const roleHierarchy = ['viewer', 'editor', 'admin', 'owner'];
    const userRoleLevel = roleHierarchy.indexOf(currentWorkspace.userRole);
    const requiredRoleLevel = roleHierarchy.indexOf(requiredRole);

    return userRoleLevel >= requiredRoleLevel;
  }, [currentWorkspace]);

  // Refresh workspaces
  const refreshWorkspaces = useCallback(() => {
    return fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Load workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const value = {
    workspaces,
    currentWorkspace,
    loading,
    switchWorkspace,
    getWorkspaceParams,
    getWorkspaceHeaders,
    canPerformAction,
    refreshWorkspaces
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

// Workspace Switcher Component (for header dropdown)
export function WorkspaceSwitcher({ className = '' }) {
  const { workspaces, currentWorkspace, switchWorkspace, loading } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  if (loading || workspaces.length === 0) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
          <span className="text-xs font-bold text-white">
            {currentWorkspace?.name?.charAt(0)?.toUpperCase() || 'W'}
          </span>
        </div>
        <span className="text-gray-900 dark:text-white font-medium max-w-[120px] truncate">
          {currentWorkspace?.name || 'Select Workspace'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1 max-h-80 overflow-y-auto">
            {workspaces.map(workspace => (
              <button
                key={workspace.id}
                onClick={() => {
                  switchWorkspace(workspace);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  currentWorkspace?.id === workspace.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {workspace.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {workspace.memberCount} members
                  </p>
                </div>
                {workspace.isDefault && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">Default</span>
                )}
                {currentWorkspace?.id === workspace.id && (
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default WorkspaceContext;

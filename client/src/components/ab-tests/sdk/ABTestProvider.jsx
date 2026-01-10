/**
 * ABTestProvider Component
 * React context provider for A/B testing SDK
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import ABTestSDK from '../../../sdk/ab-tests/ABTestSDK';

// Create context
const ABTestContext = createContext(null);

/**
 * A/B Test Provider Component
 * Initializes the SDK and provides context to child components
 */
export function ABTestProvider({ children, config, onInitialized, onError }) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!config?.workspaceId) {
      const err = new Error('workspaceId is required in ABTestProvider config');
      setError(err);
      onError?.(err);
      return;
    }

    try {
      // Initialize SDK
      ABTestSDK.init(config);
      setInitialized(true);
      onInitialized?.();

      // Listen for errors
      const unsubscribe = ABTestSDK.on('error', (errorData) => {
        console.error('[ABTestProvider] SDK Error:', errorData);
        onError?.(errorData);
      });

      return () => {
        unsubscribe();
        ABTestSDK.destroy();
      };
    } catch (err) {
      setError(err);
      onError?.(err);
    }
  }, [config?.workspaceId, config?.apiUrl]);

  // Identify user when userId changes
  useEffect(() => {
    if (initialized && config?.userId) {
      ABTestSDK.identify(config.userId, config.userTraits);
    }
  }, [initialized, config?.userId]);

  const contextValue = useMemo(
    () => ({
      sdk: ABTestSDK,
      initialized,
      error,
      workspaceId: config?.workspaceId,
    }),
    [initialized, error, config?.workspaceId]
  );

  return (
    <ABTestContext.Provider value={contextValue}>
      {children}
    </ABTestContext.Provider>
  );
}

/**
 * Hook to access ABTest context
 */
export function useABTestSDK() {
  const context = useContext(ABTestContext);

  if (!context) {
    throw new Error('useABTestSDK must be used within an ABTestProvider');
  }

  return context;
}

/**
 * Hook to check if SDK is ready
 */
export function useABTestReady() {
  const { initialized, error } = useABTestSDK();
  return { ready: initialized && !error, error };
}

export default ABTestProvider;

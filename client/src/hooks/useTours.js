/**
 * @fileoverview Tours hooks for Product Tours system
 * @module hooks/useTours
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import useApi from './useApi';

/**
 * Hook for fetching tours list with pagination
 */
export const useToursQuery = (options = {}) => {
  const { page = 1, limit = 20, status, search, workspaceId } = options;
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useApi();

  const fetchTours = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);
      if (status) params.append('status', status);
      if (search) params.append('search', search);
      if (workspaceId) params.append('workspace_id', workspaceId);

      const response = await api.get(`/tours?${params.toString()}`);
      setData(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, status, search, workspaceId]);

  useEffect(() => {
    fetchTours();
  }, [fetchTours]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchTours
  };
};

/**
 * Hook for fetching single tour
 */
export const useTourQuery = (tourId) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useApi();

  const fetchTour = useCallback(async () => {
    if (!tourId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(`/tours/${tourId}`);
      setData(response.tour);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    fetchTour();
  }, [fetchTour]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchTour
  };
};

/**
 * Hook for fetching tour analytics
 */
export const useTourAnalyticsQuery = (tourId, dateRange = '7d') => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useApi();

  const getDateParams = useCallback((range) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 7);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!tourId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateParams(dateRange);
      const response = await api.get(`/tours/${tourId}/analytics?startDate=${startDate}&endDate=${endDate}`);

      // Transform data for frontend
      const analytics = response.analytics || {};
      setData({
        impressions: analytics.totals?.impressions || 0,
        started: analytics.totals?.starts || 0,
        completed: analytics.totals?.completions || 0,
        dismissed: analytics.totals?.dismissals || 0,
        avgCompletionTime: analytics.totals?.avgTimeSeconds || 0,
        stepBreakdown: analytics.daily || []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [tourId, dateRange, getDateParams]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchAnalytics
  };
};

/**
 * Hook for tour mutations (create, update, delete)
 */
export const useTourMutations = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const api = useApi();

  const createTour = useCallback(async (tourData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/tours', tourData);
      return response.tour;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTour = useCallback(async (tourId, tourData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.put(`/tours/${tourId}`, tourData);
      return response.tour;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteTour = useCallback(async (tourId) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.del(`/tours/${tourId}`);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const duplicateTour = useCallback(async (tourId) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post(`/tours/${tourId}/duplicate`);
      return response.tour;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const publishTour = useCallback(async (tourId) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post(`/tours/${tourId}/publish`);
      return response.tour;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pauseTour = useCallback(async (tourId) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post(`/tours/${tourId}/pause`);
      return response.tour;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createTour,
    updateTour,
    deleteTour,
    duplicateTour,
    publishTour,
    pauseTour,
    isLoading,
    error
  };
};

/**
 * Hook for tour steps mutations
 */
export const useTourStepsMutations = (tourId) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const api = useApi();

  const createStep = useCallback(async (stepData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post(`/tours/${tourId}/steps`, stepData);
      return response.step;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tourId]);

  const updateStep = useCallback(async (stepId, stepData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.put(`/tours/${tourId}/steps/${stepId}`, stepData);
      return response.step;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tourId]);

  const deleteStep = useCallback(async (stepId) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.del(`/tours/${tourId}/steps/${stepId}`);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tourId]);

  const reorderSteps = useCallback(async (stepIds) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post(`/tours/${tourId}/steps/reorder`, { stepIds });
      return response.steps;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tourId]);

  return {
    createStep,
    updateStep,
    deleteStep,
    reorderSteps,
    isLoading,
    error
  };
};

export default {
  useToursQuery,
  useTourQuery,
  useTourAnalyticsQuery,
  useTourMutations,
  useTourStepsMutations
};

/**
 * Wrapper hooks for mutation functions that return objects with mutateAsync and isPending
 * These match the React Query-style API used in components
 */
export const useCreateTourMutation = () => {
  const mutations = useTourMutations();
  return {
    mutateAsync: mutations.createTour,
    isPending: mutations.isLoading
  };
};

export const useUpdateTourMutation = () => {
  const mutations = useTourMutations();
  return {
    mutateAsync: ({ id, data }) => mutations.updateTour(id, data),
    isPending: mutations.isLoading
  };
};

export const useDeleteTourMutation = () => {
  const mutations = useTourMutations();
  return {
    mutateAsync: mutations.deleteTour,
    isPending: mutations.isLoading
  };
};

export const useDuplicateTourMutation = () => {
  const mutations = useTourMutations();
  return {
    mutateAsync: mutations.duplicateTour,
    isPending: mutations.isLoading
  };
};

export const usePublishTourMutation = () => {
  const mutations = useTourMutations();
  return {
    mutateAsync: mutations.publishTour,
    isPending: mutations.isLoading
  };
};

export const usePauseTourMutation = () => {
  const mutations = useTourMutations();
  return {
    mutateAsync: mutations.pauseTour,
    isPending: mutations.isLoading
  };
};

export const useReorderStepsMutation = (tourId) => {
  const mutations = useTourStepsMutations(tourId);
  return {
    mutateAsync: mutations.reorderSteps,
    isPending: mutations.isLoading
  };
};

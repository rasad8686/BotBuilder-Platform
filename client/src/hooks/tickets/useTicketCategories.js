import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/tickets/categories';

// Fetch all categories
export function useCategoriesQuery() {
  return useQuery({
    queryKey: ['ticket-categories'],
    queryFn: async () => {
      const response = await fetch(API_BASE);
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    }
  });
}

// Fetch single category
export function useCategoryQuery(categoryId) {
  return useQuery({
    queryKey: ['ticket-category', categoryId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/${categoryId}`);
      if (!response.ok) throw new Error('Failed to fetch category');
      return response.json();
    },
    enabled: !!categoryId
  });
}

// Create category
export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryData) => {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
      if (!response.ok) throw new Error('Failed to create category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-categories'] });
    }
  });
}

// Update category
export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, data }) => {
      const response = await fetch(`${API_BASE}/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update category');
      return response.json();
    },
    onSuccess: (_, { categoryId }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-categories'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-category', categoryId] });
    }
  });
}

// Delete category
export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId) => {
      const response = await fetch(`${API_BASE}/${categoryId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-categories'] });
    }
  });
}

// Reorder categories
export function useReorderCategoriesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds) => {
      const response = await fetch(`${API_BASE}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_ids: orderedIds })
      });
      if (!response.ok) throw new Error('Failed to reorder categories');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-categories'] });
    }
  });
}

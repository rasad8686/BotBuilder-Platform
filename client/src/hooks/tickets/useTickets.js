import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/tickets';

// Fetch all tickets with filters
export function useTicketsQuery(filters = {}) {
  const queryParams = new URLSearchParams();

  if (filters.status) queryParams.append('status', filters.status);
  if (filters.priority) queryParams.append('priority', filters.priority);
  if (filters.assignee) queryParams.append('assignee', filters.assignee);
  if (filters.category) queryParams.append('category', filters.category);
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.page) queryParams.append('page', filters.page);
  if (filters.limit) queryParams.append('limit', filters.limit);
  if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
  if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json();
    }
  });
}

// Fetch single ticket by ID
export function useTicketQuery(ticketId) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/${ticketId}`);
      if (!response.ok) throw new Error('Failed to fetch ticket');
      return response.json();
    },
    enabled: !!ticketId
  });
}

// Create new ticket
export function useCreateTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketData) => {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData)
      });
      if (!response.ok) throw new Error('Failed to create ticket');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    }
  });
}

// Update ticket
export function useUpdateTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, data }) => {
      const response = await fetch(`${API_BASE}/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update ticket');
      return response.json();
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    }
  });
}

// Delete ticket
export function useDeleteTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId) => {
      const response = await fetch(`${API_BASE}/${ticketId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete ticket');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    }
  });
}

// Assign ticket to agent
export function useAssignTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, assigneeId }) => {
      const response = await fetch(`${API_BASE}/${ticketId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: assigneeId })
      });
      if (!response.ok) throw new Error('Failed to assign ticket');
      return response.json();
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    }
  });
}

// Change ticket status
export function useChangeStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, status }) => {
      const response = await fetch(`${API_BASE}/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to change ticket status');
      return response.json();
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    }
  });
}

// Bulk actions on tickets
export function useBulkActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketIds, action, data }) => {
      const response = await fetch(`${API_BASE}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_ids: ticketIds, action, ...data })
      });
      if (!response.ok) throw new Error('Failed to perform bulk action');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    }
  });
}

// Merge tickets
export function useMergeTicketsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ primaryTicketId, ticketIds }) => {
      const response = await fetch(`${API_BASE}/${primaryTicketId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_ids: ticketIds })
      });
      if (!response.ok) throw new Error('Failed to merge tickets');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    }
  });
}

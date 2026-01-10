import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/tickets/sla-policies';

// Fetch all SLA policies
export function useSLAPoliciesQuery() {
  return useQuery({
    queryKey: ['sla-policies'],
    queryFn: async () => {
      const response = await fetch(API_BASE);
      if (!response.ok) throw new Error('Failed to fetch SLA policies');
      return response.json();
    }
  });
}

// Fetch single SLA policy
export function useSLAPolicyQuery(policyId) {
  return useQuery({
    queryKey: ['sla-policy', policyId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/${policyId}`);
      if (!response.ok) throw new Error('Failed to fetch SLA policy');
      return response.json();
    },
    enabled: !!policyId
  });
}

// Create SLA policy
export function useCreateSLAPolicyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (policyData) => {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyData)
      });
      if (!response.ok) throw new Error('Failed to create SLA policy');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
    }
  });
}

// Update SLA policy
export function useUpdateSLAPolicyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ policyId, data }) => {
      const response = await fetch(`${API_BASE}/${policyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update SLA policy');
      return response.json();
    },
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
      queryClient.invalidateQueries({ queryKey: ['sla-policy', policyId] });
    }
  });
}

// Delete SLA policy
export function useDeleteSLAPolicyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (policyId) => {
      const response = await fetch(`${API_BASE}/${policyId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete SLA policy');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
    }
  });
}

// Get SLA status for a ticket
export function useTicketSLAStatusQuery(ticketId) {
  return useQuery({
    queryKey: ['ticket-sla-status', ticketId],
    queryFn: async () => {
      const response = await fetch(`/api/tickets/${ticketId}/sla`);
      if (!response.ok) throw new Error('Failed to fetch SLA status');
      return response.json();
    },
    enabled: !!ticketId,
    refetchInterval: 60000 // Refresh every minute for SLA countdown
  });
}

// Pause SLA timer
export function usePauseSLAMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId) => {
      const response = await fetch(`/api/tickets/${ticketId}/sla/pause`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to pause SLA');
      return response.json();
    },
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-sla-status', ticketId] });
    }
  });
}

// Resume SLA timer
export function useResumeSLAMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId) => {
      const response = await fetch(`/api/tickets/${ticketId}/sla/resume`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to resume SLA');
      return response.json();
    },
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-sla-status', ticketId] });
    }
  });
}

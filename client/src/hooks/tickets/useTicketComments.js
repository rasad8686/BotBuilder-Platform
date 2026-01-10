import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/tickets';

// Fetch comments for a ticket
export function useCommentsQuery(ticketId) {
  return useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/${ticketId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!ticketId
  });
}

// Add comment to ticket
export function useAddCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, content, isInternal = false, attachments = [] }) => {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('is_internal', isInternal);

      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await fetch(`${API_BASE}/${ticketId}/comments`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Failed to add comment');
      return response.json();
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    }
  });
}

// Update comment
export function useUpdateCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, commentId, content }) => {
      const response = await fetch(`${API_BASE}/${ticketId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error('Failed to update comment');
      return response.json();
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
    }
  });
}

// Delete comment
export function useDeleteCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, commentId }) => {
      const response = await fetch(`${API_BASE}/${ticketId}/comments/${commentId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete comment');
      return response.json();
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
    }
  });
}

// Mark comment as read
export function useMarkCommentReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, commentId }) => {
      const response = await fetch(`${API_BASE}/${ticketId}/comments/${commentId}/read`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to mark comment as read');
      return response.json();
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
    }
  });
}

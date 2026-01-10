// Main tickets hooks
export {
  useTicketsQuery,
  useTicketQuery,
  useCreateTicketMutation,
  useUpdateTicketMutation,
  useDeleteTicketMutation,
  useAssignTicketMutation,
  useChangeStatusMutation,
  useBulkActionMutation,
  useMergeTicketsMutation
} from './useTickets';

// Comments hooks
export {
  useCommentsQuery,
  useAddCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
  useMarkCommentReadMutation
} from './useTicketComments';

// Categories hooks
export {
  useCategoriesQuery,
  useCategoryQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useReorderCategoriesMutation
} from './useTicketCategories';

// SLA hooks
export {
  useSLAPoliciesQuery,
  useSLAPolicyQuery,
  useCreateSLAPolicyMutation,
  useUpdateSLAPolicyMutation,
  useDeleteSLAPolicyMutation,
  useTicketSLAStatusQuery,
  usePauseSLAMutation,
  useResumeSLAMutation
} from './useTicketSLA';

// Canned responses hooks
export {
  useCannedResponsesQuery,
  useCannedResponseQuery,
  useCreateCannedResponseMutation,
  useUpdateCannedResponseMutation,
  useDeleteCannedResponseMutation,
  useTrackCannedResponseUsageMutation,
  useCannedResponseCategoriesQuery
} from './useCannedResponses';

// Analytics hooks
export {
  useTicketStatsQuery,
  useAgentStatsQuery,
  useSLAPerformanceQuery,
  useTicketsByStatusQuery,
  useTicketsByPriorityQuery,
  useTicketTrendQuery,
  useResponseTimeQuery,
  useResolutionTimeQuery,
  useCustomerSatisfactionQuery,
  useCategoryDistributionQuery,
  useHourlyDistributionQuery,
  useTopCustomersQuery
} from './useTicketAnalytics';

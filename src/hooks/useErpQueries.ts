import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

export const ERP_QUERY_KEYS = {
  students: ['erp', 'students'] as const,
  transactions: ['erp', 'transactions'] as const,
  grades: ['erp', 'grades'] as const,
  attendance: ['erp', 'attendance'] as const,
  auditLogs: ['erp', 'auditLogs'] as const,
};

export function useErpAuditLogsQuery() {
  return useQuery({
    queryKey: ERP_QUERY_KEYS.auditLogs,
    queryFn: () => apiClient.fetchServerAuditLogs(),
    staleTime: 10000,
  });
}

export function useInvalidateErpQueries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['erp'] });
  };
}

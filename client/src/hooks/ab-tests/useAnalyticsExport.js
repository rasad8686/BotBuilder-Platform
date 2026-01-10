/**
 * useAnalyticsExport Hook
 * Export A/B test analytics data to CSV/PDF
 */

import { useState, useCallback } from 'react';
import useApi from '../useApi';

/**
 * useAnalyticsExport - Export analytics data
 */
export function useAnalyticsExport() {
  const api = useApi();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Export to CSV
   */
  const exportToCSV = useCallback(async ({
    testId,
    workspaceId,
    period = '30d',
    startDate,
    endDate,
    includeVariants = true,
    includeTimeline = true,
    includeHourly = false
  } = {}) => {
    setExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        format: 'csv',
        period,
        includeVariants: String(includeVariants),
        includeTimeline: String(includeTimeline),
        includeHourly: String(includeHourly)
      });

      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      const endpoint = testId
        ? `/api/ab-tests/${testId}/analytics/export?${params}`
        : `/api/workspaces/${workspaceId}/ab-tests/analytics/export?${params}`;

      const response = await api.get(endpoint, { responseType: 'blob' });

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = testId
        ? `ab-test-${testId}-analytics.csv`
        : `ab-tests-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setError(err.message || 'Failed to export CSV');
      return false;
    } finally {
      setExporting(false);
    }
  }, [api]);

  /**
   * Export to PDF
   */
  const exportToPDF = useCallback(async ({
    testId,
    workspaceId,
    period = '30d',
    startDate,
    endDate,
    includeCharts = true
  } = {}) => {
    setExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        format: 'pdf',
        period,
        includeCharts: String(includeCharts)
      });

      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      const endpoint = testId
        ? `/api/ab-tests/${testId}/analytics/export?${params}`
        : `/api/workspaces/${workspaceId}/ab-tests/analytics/export?${params}`;

      const response = await api.get(endpoint, { responseType: 'blob' });

      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = testId
        ? `ab-test-${testId}-report.pdf`
        : `ab-tests-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError(err.message || 'Failed to export PDF');
      return false;
    } finally {
      setExporting(false);
    }
  }, [api]);

  /**
   * Export variant data to CSV (client-side)
   */
  const exportVariantsToCSV = useCallback((variants, testName = 'ab-test') => {
    if (!variants || variants.length === 0) {
      setError('No variant data to export');
      return false;
    }

    try {
      const headers = [
        'Variant',
        'Impressions',
        'Conversions',
        'Conversion Rate',
        'Lift vs Control',
        'Confidence',
        'Status',
        'Is Control'
      ];

      // Find control for lift calculation
      const control = variants.find(v => v.isControl);
      const controlRate = control?.conversionRate || 0;

      const rows = variants.map(v => {
        const rate = v.conversionRate || (v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0);
        const lift = v.isControl ? 0 : (controlRate > 0 ? ((rate - controlRate) / controlRate) * 100 : 0);

        return [
          v.name || v.variantName,
          v.impressions || 0,
          v.conversions || 0,
          `${rate.toFixed(2)}%`,
          v.isControl ? '-' : `${lift >= 0 ? '+' : ''}${lift.toFixed(2)}%`,
          `${(v.confidence || 0).toFixed(1)}%`,
          v.status || 'active',
          v.isControl ? 'Yes' : 'No'
        ];
      });

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${testName}-variants-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      console.error('Error exporting variants:', err);
      setError(err.message || 'Failed to export variants');
      return false;
    }
  }, []);

  /**
   * Export timeline data to CSV (client-side)
   */
  const exportTimelineToCSV = useCallback((timelineData, testName = 'ab-test') => {
    if (!timelineData || timelineData.length === 0) {
      setError('No timeline data to export');
      return false;
    }

    try {
      // Get all variants
      const variantSet = new Set();
      timelineData.forEach(item => {
        const name = item.variantName || item.variant_name;
        if (name) variantSet.add(name);
      });
      const variants = Array.from(variantSet).sort();

      // Build headers
      const headers = ['Date'];
      variants.forEach(v => {
        headers.push(`Variant ${v} - Impressions`);
        headers.push(`Variant ${v} - Conversions`);
        headers.push(`Variant ${v} - Conv. Rate`);
      });

      // Group by date
      const dateMap = new Map();
      timelineData.forEach(item => {
        const date = item.date;
        const name = item.variantName || item.variant_name;
        if (!dateMap.has(date)) {
          dateMap.set(date, {});
        }
        dateMap.get(date)[name] = item;
      });

      // Build rows
      const rows = [];
      Array.from(dateMap.entries())
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .forEach(([date, variantData]) => {
          const row = [date];
          variants.forEach(v => {
            const data = variantData[v] || {};
            row.push(data.impressions || 0);
            row.push(data.conversions || 0);
            row.push(`${(data.conversionRate || data.conversion_rate || 0).toFixed(2)}%`);
          });
          rows.push(row);
        });

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${testName}-timeline-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      console.error('Error exporting timeline:', err);
      setError(err.message || 'Failed to export timeline');
      return false;
    }
  }, []);

  return {
    exportToCSV,
    exportToPDF,
    exportVariantsToCSV,
    exportTimelineToCSV,
    exporting,
    error,
    clearError: () => setError(null)
  };
}

export default useAnalyticsExport;

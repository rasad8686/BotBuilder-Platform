/**
 * @fileoverview Hook for exporting analytics data to CSV/PDF
 * @module hooks/tours/useAnalyticsExport
 */

import { useState, useCallback } from 'react';
import useApi from '../useApi';

/**
 * Convert data to CSV format
 * @param {Array} data - Array of objects
 * @param {Array} columns - Column definitions [{ key, label }]
 * @returns {string} CSV string
 */
const convertToCSV = (data, columns) => {
  if (!data || data.length === 0) return '';

  // Header row
  const header = columns.map(col => `"${col.label}"`).join(',');

  // Data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '""';
      if (typeof value === 'number') return value;
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [header, ...rows].join('\n');
};

/**
 * Trigger file download
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} type - MIME type
 */
const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Hook for exporting tour analytics data
 * @returns {Object} { exportCSV, exportPDF, isExporting }
 */
export const useAnalyticsExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  const api = useApi();

  /**
   * Export data to CSV format
   * @param {Object} options - Export options
   * @param {string} options.tourId - Optional tour ID for single tour export
   * @param {string} options.startDate - Start date
   * @param {string} options.endDate - End date
   * @param {string} options.type - Export type ('summary', 'daily', 'steps', 'all')
   */
  const exportCSV = useCallback(async (options = {}) => {
    const { tourId, startDate, endDate, type = 'all' } = options;

    setIsExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('format', 'csv');
      if (tourId) params.append('tourId', tourId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      // Try to get data from API
      const response = await api.get(`/tours/analytics/export?${params.toString()}`);

      if (response.csv) {
        // Server returned CSV directly
        downloadFile(response.csv, `tour-analytics-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      } else if (response.data) {
        // Server returned JSON, convert to CSV
        let csvContent = '';
        const dateStr = new Date().toISOString().split('T')[0];

        if (type === 'summary' || type === 'all') {
          const summaryColumns = [
            { key: 'tourName', label: 'Tour Name' },
            { key: 'status', label: 'Status' },
            { key: 'impressions', label: 'Impressions' },
            { key: 'starts', label: 'Starts' },
            { key: 'completions', label: 'Completions' },
            { key: 'rate', label: 'Completion Rate (%)' },
            { key: 'avgTime', label: 'Avg Time (seconds)' }
          ];
          csvContent += 'TOURS SUMMARY\n';
          csvContent += convertToCSV(response.data.tours || [], summaryColumns);
          csvContent += '\n\n';
        }

        if (type === 'daily' || type === 'all') {
          const dailyColumns = [
            { key: 'date', label: 'Date' },
            { key: 'impressions', label: 'Impressions' },
            { key: 'starts', label: 'Starts' },
            { key: 'completions', label: 'Completions' },
            { key: 'dismissals', label: 'Dismissals' }
          ];
          csvContent += 'DAILY STATISTICS\n';
          csvContent += convertToCSV(response.data.daily || [], dailyColumns);
          csvContent += '\n\n';
        }

        if (type === 'steps' || type === 'all') {
          const stepsColumns = [
            { key: 'stepOrder', label: 'Step #' },
            { key: 'title', label: 'Title' },
            { key: 'views', label: 'Views' },
            { key: 'completions', label: 'Completions' },
            { key: 'dropOffRate', label: 'Drop-off Rate (%)' },
            { key: 'avgTime', label: 'Avg Time (seconds)' }
          ];
          csvContent += 'STEP BREAKDOWN\n';
          csvContent += convertToCSV(response.data.steps || [], stepsColumns);
        }

        downloadFile(csvContent, `tour-analytics-${dateStr}.csv`, 'text/csv');
      }

      return true;
    } catch (err) {
      setError(err.message);

      // Fallback: Create CSV from local data if provided
      if (options.localData) {
        const { tours, daily, steps } = options.localData;
        let csvContent = '';
        const dateStr = new Date().toISOString().split('T')[0];

        if (tours && tours.length > 0) {
          const summaryColumns = [
            { key: 'name', label: 'Tour Name' },
            { key: 'status', label: 'Status' },
            { key: 'impressions', label: 'Impressions' },
            { key: 'starts', label: 'Starts' },
            { key: 'completions', label: 'Completions' },
            { key: 'completion_rate', label: 'Completion Rate (%)' }
          ];
          csvContent += 'TOURS SUMMARY\n';
          csvContent += convertToCSV(tours, summaryColumns);
          csvContent += '\n\n';
        }

        if (daily && daily.length > 0) {
          const dailyColumns = [
            { key: 'date', label: 'Date' },
            { key: 'impressions', label: 'Impressions' },
            { key: 'starts', label: 'Starts' },
            { key: 'completions', label: 'Completions' },
            { key: 'dismissals', label: 'Dismissals' }
          ];
          csvContent += 'DAILY STATISTICS\n';
          csvContent += convertToCSV(daily, dailyColumns);
          csvContent += '\n\n';
        }

        if (steps && steps.length > 0) {
          const stepsColumns = [
            { key: 'stepOrder', label: 'Step #' },
            { key: 'title', label: 'Title' },
            { key: 'views', label: 'Views' },
            { key: 'completions', label: 'Completions' },
            { key: 'dropOffRate', label: 'Drop-off Rate (%)' },
            { key: 'avgTime', label: 'Avg Time (seconds)' }
          ];
          csvContent += 'STEP BREAKDOWN\n';
          csvContent += convertToCSV(steps, stepsColumns);
        }

        if (csvContent) {
          downloadFile(csvContent, `tour-analytics-${dateStr}.csv`, 'text/csv');
          return true;
        }
      }

      throw err;
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Export data to PDF format
   * @param {Object} options - Export options
   */
  const exportPDF = useCallback(async (options = {}) => {
    const { tourId, startDate, endDate, localData } = options;

    setIsExporting(true);
    setError(null);

    try {
      // For PDF, we need jspdf library (should be available in the project)
      const { default: jsPDF } = await import('jspdf');

      const doc = new jsPDF();
      const dateStr = new Date().toISOString().split('T')[0];
      let yPosition = 20;

      // Title
      doc.setFontSize(18);
      doc.text('Tour Analytics Report', 20, yPosition);
      yPosition += 10;

      // Date range
      doc.setFontSize(10);
      doc.text(`Period: ${startDate || 'N/A'} - ${endDate || 'N/A'}`, 20, yPosition);
      yPosition += 10;
      doc.text(`Generated: ${dateStr}`, 20, yPosition);
      yPosition += 15;

      if (localData) {
        // Summary section
        if (localData.summary) {
          doc.setFontSize(14);
          doc.text('Summary', 20, yPosition);
          yPosition += 8;

          doc.setFontSize(10);
          const { totalTours, totalImpressions, avgCompletionRate, totalCompletions } = localData.summary;
          doc.text(`Total Tours: ${totalTours || 0}`, 25, yPosition);
          yPosition += 6;
          doc.text(`Total Impressions: ${totalImpressions || 0}`, 25, yPosition);
          yPosition += 6;
          doc.text(`Avg Completion Rate: ${avgCompletionRate || 0}%`, 25, yPosition);
          yPosition += 6;
          doc.text(`Total Completions: ${totalCompletions || 0}`, 25, yPosition);
          yPosition += 15;
        }

        // Top tours
        if (localData.topTours && localData.topTours.length > 0) {
          doc.setFontSize(14);
          doc.text('Top Tours', 20, yPosition);
          yPosition += 8;

          doc.setFontSize(10);
          localData.topTours.slice(0, 5).forEach((tour, index) => {
            doc.text(`${index + 1}. ${tour.name || 'Unnamed'} - ${tour.completions || 0} completions (${tour.completion_rate || 0}%)`, 25, yPosition);
            yPosition += 6;
          });
        }
      }

      doc.save(`tour-analytics-${dateStr}.pdf`);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    exportCSV,
    exportPDF,
    isExporting,
    error
  };
};

export default useAnalyticsExport;

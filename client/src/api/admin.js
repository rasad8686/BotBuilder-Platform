import axiosInstance from './axios';

/**
 * Admin API Service
 * All endpoints require admin role
 */

/**
 * Get audit logs with filters and pagination
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.limit - Items per page (default: 50)
 * @param {string} params.user_id - Filter by user ID
 * @param {string} params.action - Filter by action type
 * @param {string} params.resource_type - Filter by resource type
 * @param {string} params.start_date - Filter by start date
 * @param {string} params.end_date - Filter by end date
 * @returns {Promise} Audit logs with pagination
 */
export const getAuditLogs = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/api/admin/audit-logs', { params });
    return response.data;
  } catch (error) {
    console.error('Get audit logs error:', error);
    throw error;
  }
};

/**
 * Get list of unique actions for filtering
 * @returns {Promise} Array of action strings
 */
export const getAuditActions = async () => {
  try {
    const response = await axiosInstance.get('/api/admin/audit-logs/actions');
    return response.data;
  } catch (error) {
    console.error('Get audit actions error:', error);
    throw error;
  }
};

/**
 * Get organization statistics
 * @returns {Promise} Statistics object
 */
export const getStats = async () => {
  try {
    const response = await axiosInstance.get('/api/admin/stats');
    return response.data;
  } catch (error) {
    console.error('Get stats error:', error);
    throw error;
  }
};

/**
 * Get system health status
 * @returns {Promise} Health check object
 */
export const getHealth = async () => {
  try {
    const response = await axiosInstance.get('/api/admin/health');
    return response.data;
  } catch (error) {
    console.error('Get health error:', error);
    throw error;
  }
};

/**
 * Get activity timeline
 * @param {Object} params - Query parameters
 * @param {number} params.days - Number of days to look back (default: 7)
 * @param {number} params.limit - Maximum items to return (default: 100)
 * @returns {Promise} Timeline array
 */
export const getActivityTimeline = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/api/admin/activity-timeline', { params });
    return response.data;
  } catch (error) {
    console.error('Get activity timeline error:', error);
    throw error;
  }
};

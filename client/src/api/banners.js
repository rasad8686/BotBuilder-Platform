import axiosInstance from './axios';

/**
 * Banner API Service
 * All endpoints require admin role
 */

/**
 * Get all banners with optional filters
 * @param {Object} params - Query parameters
 * @param {string} params.type - Filter by type (info, warning, success, error, promo)
 * @param {string} params.status - Filter by status (active, inactive)
 * @param {string} params.target_audience - Filter by target audience
 * @param {string} params.search - Search in title/message
 * @returns {Promise} Banners array
 */
export const getBanners = async (params = {}) => {
  const response = await axiosInstance.get('/api/banners/admin', { params });
  return response.data;
};

/**
 * Get single banner by ID
 * @param {number} id - Banner ID
 * @returns {Promise} Banner object
 */
export const getBanner = async (id) => {
  const response = await axiosInstance.get(`/api/banners/admin/${id}`);
  return response.data;
};

/**
 * Create a new banner
 * @param {Object} data - Banner data
 * @param {string} data.title - Banner title
 * @param {string} data.message - Banner message
 * @param {string} data.type - Banner type (info, warning, success, error, promo)
 * @param {string} data.background_color - Custom background color (optional)
 * @param {string} data.text_color - Custom text color (optional)
 * @param {string} data.link_url - Link URL (optional)
 * @param {string} data.link_text - Link text (optional)
 * @param {string} data.target_audience - Target audience
 * @param {string} data.start_date - Start date (ISO string)
 * @param {string} data.end_date - End date (ISO string, optional)
 * @param {boolean} data.is_dismissible - Whether banner can be dismissed
 * @param {boolean} data.is_active - Whether banner is active
 * @param {number} data.priority - Priority order
 * @returns {Promise} Created banner object
 */
export const createBanner = async (data) => {
  const response = await axiosInstance.post('/api/banners/admin', data);
  return response.data;
};

/**
 * Update an existing banner
 * @param {number} id - Banner ID
 * @param {Object} data - Banner data to update
 * @returns {Promise} Updated banner object
 */
export const updateBanner = async (id, data) => {
  const response = await axiosInstance.put(`/api/banners/admin/${id}`, data);
  return response.data;
};

/**
 * Delete a banner
 * @param {number} id - Banner ID
 * @returns {Promise} Success response
 */
export const deleteBanner = async (id) => {
  const response = await axiosInstance.delete(`/api/banners/admin/${id}`);
  return response.data;
};

/**
 * Toggle banner active status
 * @param {number} id - Banner ID
 * @returns {Promise} Updated banner object
 */
export const toggleBannerStatus = async (id) => {
  const response = await axiosInstance.post(`/api/banners/admin/${id}/toggle`);
  return response.data;
};

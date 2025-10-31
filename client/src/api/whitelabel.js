import axiosInstance from './axiosConfig';

/**
 * White-label API Service
 * Handles all white-label/custom branding API calls
 */

/**
 * Get whitelabel settings for current organization
 */
export const getSettings = async () => {
  const response = await axiosInstance.get('/api/whitelabel/settings');
  return response.data;
};

/**
 * Update whitelabel settings
 */
export const updateSettings = async (settings) => {
  const response = await axiosInstance.put('/api/whitelabel/settings', settings);
  return response.data;
};

/**
 * Upload logo file
 */
export const uploadLogo = async (file) => {
  const formData = new FormData();
  formData.append('logo', file);

  const response = await axiosInstance.post('/api/whitelabel/upload-logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

/**
 * Upload favicon file
 */
export const uploadFavicon = async (file) => {
  const formData = new FormData();
  formData.append('favicon', file);

  const response = await axiosInstance.post('/api/whitelabel/upload-favicon', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

/**
 * Get public whitelabel settings by domain (no auth required)
 */
export const getPublicSettings = async (domain) => {
  const response = await axiosInstance.get(`/api/whitelabel/public/${domain}`);
  return response.data;
};

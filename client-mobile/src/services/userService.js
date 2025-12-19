/**
 * User Service
 * Handles user profile and account operations
 */
import { userAPI, authAPI } from './api';
import { setUserData, getUserData, removeUserData } from '../utils/storage';
import { Platform } from 'react-native';

/**
 * Get current user profile
 */
export const getProfile = async (options = {}) => {
  const { useCache = true, forceRefresh = false } = options;

  try {
    // Try cache first if not forcing refresh
    if (useCache && !forceRefresh) {
      const cached = await getUserData();
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }
    }

    const response = await userAPI.getProfile();
    const user = response.data.user || response.data;

    // Cache the results
    if (useCache) {
      await setUserData(user);
    }

    return { success: true, data: user, fromCache: false };
  } catch (error) {
    // Return cached data if available on error
    if (useCache) {
      const cached = await getUserData();
      if (cached) {
        return { success: true, data: cached, fromCache: true, error: error.message };
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to fetch profile',
      data: null,
    };
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (updates) => {
  try {
    const response = await userAPI.updateProfile(updates);
    const user = response.data.user || response.data;

    // Update cache
    await setUserData(user);

    return { success: true, data: user };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to update profile',
      data: null,
    };
  }
};

/**
 * Change password
 */
export const changePassword = async (currentPassword, newPassword) => {
  try {
    await userAPI.changePassword(currentPassword, newPassword);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to change password',
    };
  }
};

/**
 * Upload avatar image
 */
export const uploadAvatar = async (imageUri) => {
  try {
    const formData = new FormData();

    // Get file extension
    const uriParts = imageUri.split('.');
    const fileType = uriParts[uriParts.length - 1];

    formData.append('avatar', {
      uri: imageUri,
      name: `avatar.${fileType}`,
      type: `image/${fileType}`,
    });

    const response = await userAPI.uploadAvatar(formData);
    const avatarUrl = response.data.avatarUrl || response.data.url;

    // Update cached user data with new avatar
    const cachedUser = await getUserData();
    if (cachedUser) {
      await setUserData({ ...cachedUser, avatar: avatarUrl });
    }

    return { success: true, data: { avatarUrl } };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to upload avatar',
      data: null,
    };
  }
};

/**
 * Delete avatar
 */
export const deleteAvatar = async () => {
  try {
    await userAPI.updateProfile({ avatar: null });

    // Update cached user data
    const cachedUser = await getUserData();
    if (cachedUser) {
      await setUserData({ ...cachedUser, avatar: null });
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to delete avatar',
    };
  }
};

/**
 * Get user settings
 */
export const getSettings = async () => {
  try {
    const response = await userAPI.getSettings();
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch settings',
      data: null,
    };
  }
};

/**
 * Update user settings
 */
export const updateSettings = async (settings) => {
  try {
    const response = await userAPI.updateSettings(settings);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to update settings',
    };
  }
};

/**
 * Get user subscription info
 */
export const getSubscription = async () => {
  try {
    const response = await userAPI.getSubscription();
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch subscription',
      data: null,
    };
  }
};

/**
 * Delete user account
 */
export const deleteAccount = async () => {
  try {
    await authAPI.deleteAccount();
    await removeUserData();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to delete account',
    };
  }
};

/**
 * Request data export (GDPR)
 */
export const requestDataExport = async () => {
  try {
    const response = await userAPI.getProfile(); // Placeholder - implement actual export endpoint
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to request data export',
    };
  }
};

/**
 * Get device info for push notifications
 */
export const getDeviceInfo = () => {
  return {
    platform: Platform.OS,
    version: Platform.Version,
    isTV: Platform.isTV,
  };
};

/**
 * Validate profile data
 */
export const validateProfileData = (data) => {
  const errors = {};

  if (data.name !== undefined) {
    if (!data.name || data.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    if (data.name && data.name.length > 100) {
      errors.name = 'Name must be less than 100 characters';
    }
  }

  if (data.phone !== undefined && data.phone) {
    const phoneRegex = /^\+?[\d\s-]{10,15}$/;
    if (!phoneRegex.test(data.phone)) {
      errors.phone = 'Invalid phone number format';
    }
  }

  if (data.bio !== undefined && data.bio) {
    if (data.bio.length > 500) {
      errors.bio = 'Bio must be less than 500 characters';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export default {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  deleteAvatar,
  getSettings,
  updateSettings,
  getSubscription,
  deleteAccount,
  requestDataExport,
  getDeviceInfo,
  validateProfileData,
};

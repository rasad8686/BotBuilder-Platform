import api from './api';
import type { ApiResponse, User, LoginCredentials, RegisterCredentials } from '../types';

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

interface TokenResponse {
  token: string;
  refreshToken: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await api.post('/auth/login', credentials);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed',
      };
    }
  },

  async register(credentials: RegisterCredentials): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await api.post('/auth/register', credentials);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed',
      };
    }
  },

  async logout(): Promise<ApiResponse<void>> {
    try {
      await api.post('/auth/logout');
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Logout failed',
      };
    }
  },

  async refreshToken(refreshToken: string): Promise<ApiResponse<TokenResponse>> {
    try {
      const response = await api.post('/auth/refresh', { refreshToken });
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Token refresh failed',
      };
    }
  },

  async getProfile(): Promise<ApiResponse<User>> {
    try {
      const response = await api.get('/auth/profile');
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to get profile',
      };
    }
  },

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    try {
      const response = await api.put('/auth/profile', updates);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update profile',
      };
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to change password',
      };
    }
  },

  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    try {
      await api.post('/auth/forgot-password', { email });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to send reset email',
      };
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to reset password',
      };
    }
  },
};

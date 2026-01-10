/**
 * @fileoverview Central export file for all custom React hooks
 * @module hooks
 *
 * @description
 * This file exports all custom hooks from a single entry point.
 * Import hooks like: import { useAuth, useApi, useForm } from '@/hooks';
 *
 * Available hooks:
 * - useAuth: Authentication state and operations
 * - useApi: HTTP requests with loading/error states
 * - useForm: Form state management with validation
 * - useModal: Modal open/close state management
 * - useToast: Toast notification system
 * - useLocalStorage: Persistent localStorage with JSON support
 * - useDebounce: Value debouncing for search inputs
 * - usePagination: Pagination state and controls
 * - useWebSocket: Real-time WebSocket connections
 * - useBots: Bot CRUD operations
 * - useExecutionSocket: Execution real-time updates (Socket.IO)
 */

// Authentication
export { default as useAuth } from './useAuth';

// API & Data Fetching
export { default as useApi } from './useApi';

// Form Management
export { default as useForm } from './useForm';

// UI State
export { default as useModal, useModals } from './useModal';
export { default as useToast } from './useToast';

// Storage
export { default as useLocalStorage, useLocalStorageState } from './useLocalStorage';

// Utilities
export { default as useDebounce, useDebouncedCallback, useDebouncedState, useDebouncedEffect } from './useDebounce';
export { default as usePagination, useArrayPagination } from './usePagination';

// Real-time & WebSocket
export { default as useWebSocket, useWebSocketChannel } from './useWebSocket';
export { default as useExecutionSocket } from './useExecutionSocket';
export { useFineTuningProgress, useModelTrainingProgress } from './useFineTuningProgress';

// Domain-specific
export { default as useBots } from './useBots';
export { default as useBanners } from './useBanners';

// Import all hooks for default export object
import useAuth from './useAuth';
import useApi from './useApi';
import useForm from './useForm';
import useModal, { useModals } from './useModal';
import useToast from './useToast';
import useLocalStorage, { useLocalStorageState } from './useLocalStorage';
import useDebounce, { useDebouncedCallback, useDebouncedState, useDebouncedEffect } from './useDebounce';
import usePagination, { useArrayPagination } from './usePagination';
import useWebSocket, { useWebSocketChannel } from './useWebSocket';
import useExecutionSocket from './useExecutionSocket';
import { useFineTuningProgress, useModelTrainingProgress } from './useFineTuningProgress';
import useBots from './useBots';
import useBanners from './useBanners';

/**
 * Default export with all hooks
 * @example
 * import hooks from '@/hooks';
 * const { useAuth, useApi } = hooks;
 */
const hooks = {
  useAuth,
  useApi,
  useForm,
  useModal,
  useModals,
  useToast,
  useLocalStorage,
  useLocalStorageState,
  useDebounce,
  useDebouncedCallback,
  useDebouncedState,
  useDebouncedEffect,
  usePagination,
  useArrayPagination,
  useWebSocket,
  useWebSocketChannel,
  useExecutionSocket,
  useFineTuningProgress,
  useModelTrainingProgress,
  useBots,
  useBanners
};

export default hooks;

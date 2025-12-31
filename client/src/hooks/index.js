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

// Domain-specific
export { default as useBots } from './useBots';

/**
 * Default export with all hooks
 * @example
 * import hooks from '@/hooks';
 * const { useAuth, useApi } = hooks;
 */
const hooks = {
  useAuth: require('./useAuth').default,
  useApi: require('./useApi').default,
  useForm: require('./useForm').default,
  useModal: require('./useModal').default,
  useModals: require('./useModal').useModals,
  useToast: require('./useToast').default,
  useLocalStorage: require('./useLocalStorage').default,
  useLocalStorageState: require('./useLocalStorage').useLocalStorageState,
  useDebounce: require('./useDebounce').default,
  useDebouncedCallback: require('./useDebounce').useDebouncedCallback,
  useDebouncedState: require('./useDebounce').useDebouncedState,
  useDebouncedEffect: require('./useDebounce').useDebouncedEffect,
  usePagination: require('./usePagination').default,
  useArrayPagination: require('./usePagination').useArrayPagination,
  useWebSocket: require('./useWebSocket').default,
  useWebSocketChannel: require('./useWebSocket').useWebSocketChannel,
  useExecutionSocket: require('./useExecutionSocket').default,
  useBots: require('./useBots').default
};

export default hooks;

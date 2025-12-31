/**
 * @fileoverview Modal state management hook
 * @module hooks/useModal
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for managing modal open/close state
 * @param {boolean} initialState - Initial open state (default: false)
 * @param {Object} options - Configuration options
 * @param {Function} options.onOpen - Callback when modal opens
 * @param {Function} options.onClose - Callback when modal closes
 * @param {boolean} options.closeOnEscape - Close on Escape key (default: true)
 * @param {boolean} options.preventBodyScroll - Prevent body scroll when open (default: true)
 * @returns {Object} Modal state and controls
 * @property {boolean} isOpen - Whether modal is open
 * @property {any} data - Data passed to modal when opening
 * @property {Function} open - Open modal with optional data
 * @property {Function} close - Close modal
 * @property {Function} toggle - Toggle modal state
 * @property {Function} setData - Update modal data
 *
 * @example
 * const { isOpen, open, close, data } = useModal();
 *
 * // Open with data
 * <button onClick={() => open({ userId: 123 })}>Edit User</button>
 *
 * // Use in modal
 * <Modal isOpen={isOpen} onClose={close}>
 *   <UserForm userId={data?.userId} />
 * </Modal>
 */
const useModal = (initialState = false, options = {}) => {
  const {
    onOpen,
    onClose,
    closeOnEscape = true,
    preventBodyScroll = true
  } = options;

  const [isOpen, setIsOpen] = useState(initialState);
  const [data, setData] = useState(null);

  /**
   * Open the modal with optional data
   * @param {any} modalData - Data to pass to modal
   */
  const open = useCallback((modalData = null) => {
    setData(modalData);
    setIsOpen(true);
    onOpen?.(modalData);
  }, [onOpen]);

  /**
   * Close the modal
   */
  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.(data);
    // Don't clear data immediately to allow for close animations
    setTimeout(() => setData(null), 300);
  }, [onClose, data]);

  /**
   * Toggle modal state
   * @param {any} modalData - Data to pass when opening
   */
  const toggle = useCallback((modalData = null) => {
    if (isOpen) {
      close();
    } else {
      open(modalData);
    }
  }, [isOpen, open, close]);

  // Handle Escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeOnEscape, isOpen, close]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!preventBodyScroll) return;

    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen, preventBodyScroll]);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    setData
  };
};

/**
 * Hook for managing multiple modals
 * @returns {Object} Multi-modal controls
 * @property {Object} modals - Map of modal states
 * @property {Function} openModal - Open a specific modal
 * @property {Function} closeModal - Close a specific modal
 * @property {Function} isModalOpen - Check if modal is open
 * @property {Function} getModalData - Get modal data
 * @property {Function} closeAll - Close all modals
 *
 * @example
 * const { openModal, closeModal, isModalOpen, getModalData } = useModals();
 *
 * <button onClick={() => openModal('edit', { id: 1 })}>Edit</button>
 * <button onClick={() => openModal('delete', { id: 1 })}>Delete</button>
 *
 * {isModalOpen('edit') && <EditModal data={getModalData('edit')} onClose={() => closeModal('edit')} />}
 */
export const useModals = () => {
  const [modals, setModals] = useState({});

  const openModal = useCallback((name, data = null) => {
    setModals(prev => ({
      ...prev,
      [name]: { isOpen: true, data }
    }));
  }, []);

  const closeModal = useCallback((name) => {
    setModals(prev => ({
      ...prev,
      [name]: { isOpen: false, data: null }
    }));
  }, []);

  const isModalOpen = useCallback((name) => {
    return modals[name]?.isOpen || false;
  }, [modals]);

  const getModalData = useCallback((name) => {
    return modals[name]?.data || null;
  }, [modals]);

  const closeAll = useCallback(() => {
    setModals({});
  }, []);

  return {
    modals,
    openModal,
    closeModal,
    isModalOpen,
    getModalData,
    closeAll
  };
};

export default useModal;

import { forwardRef, useEffect, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Modal Component with sizes, animations, and accessibility
 * Follows BotBuilder Design System tokens
 */
const Modal = forwardRef(({
  isOpen = false,
  onClose,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
  overlayClassName = '',
  ...props
}, ref) => {
  // Handle escape key
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape' && closeOnEscape && onClose) {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  // Handle overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick && onClose) {
      onClose();
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, handleEscape]);

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]'
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: 10
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 25,
        stiffness: 300
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 10,
      transition: {
        duration: 0.15
      }
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <Fragment>
          {/* Overlay */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={{ duration: 0.15 }}
            onClick={handleOverlayClick}
            className={`
              fixed inset-0 z-50
              bg-black/50 dark:bg-black/70
              backdrop-blur-sm
              flex items-center justify-center p-4
              ${overlayClassName}
            `}
            aria-hidden="true"
          >
            {/* Modal */}
            <motion.div
              ref={ref}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className={`
                relative w-full ${sizes[size]}
                bg-white dark:bg-slate-800
                rounded-2xl shadow-2xl
                border border-gray-200 dark:border-slate-700
                overflow-hidden
                ${className}
              `}
              {...props}
            >
              {/* Close Button */}
              {showCloseButton && onClose && (
                <button
                  onClick={onClose}
                  className="
                    absolute top-4 right-4 z-10
                    p-2 rounded-lg
                    text-gray-400 hover:text-gray-600
                    dark:text-gray-500 dark:hover:text-gray-300
                    hover:bg-gray-100 dark:hover:bg-slate-700
                    transition-colors
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500
                  "
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {children}
            </motion.div>
          </motion.div>
        </Fragment>
      )}
    </AnimatePresence>
  );

  // Use portal to render modal at document body level
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return null;
});

Modal.displayName = 'Modal';

/**
 * ModalHeader Component
 */
const ModalHeader = forwardRef(({
  children,
  className = '',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`px-6 pt-6 pb-4 ${className}`}
    {...props}
  >
    {children}
  </div>
));

ModalHeader.displayName = 'ModalHeader';

/**
 * ModalTitle Component
 */
const ModalTitle = forwardRef(({
  children,
  className = '',
  ...props
}, ref) => (
  <h2
    ref={ref}
    className={`text-xl font-semibold text-gray-900 dark:text-white pr-8 ${className}`}
    {...props}
  >
    {children}
  </h2>
));

ModalTitle.displayName = 'ModalTitle';

/**
 * ModalDescription Component
 */
const ModalDescription = forwardRef(({
  children,
  className = '',
  ...props
}, ref) => (
  <p
    ref={ref}
    className={`mt-2 text-sm text-gray-500 dark:text-gray-400 ${className}`}
    {...props}
  >
    {children}
  </p>
));

ModalDescription.displayName = 'ModalDescription';

/**
 * ModalBody Component
 */
const ModalBody = forwardRef(({
  children,
  className = '',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`px-6 py-4 ${className}`}
    {...props}
  >
    {children}
  </div>
));

ModalBody.displayName = 'ModalBody';

/**
 * ModalFooter Component
 */
const ModalFooter = forwardRef(({
  children,
  className = '',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`
      px-6 py-4
      bg-gray-50 dark:bg-slate-900/50
      border-t border-gray-200 dark:border-slate-700
      flex items-center justify-end gap-3
      ${className}
    `}
    {...props}
  >
    {children}
  </div>
));

ModalFooter.displayName = 'ModalFooter';

/**
 * ConfirmModal - Pre-built confirmation modal
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false
}) => {
  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    primary: 'bg-purple-600 hover:bg-purple-700 text-white'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
        <ModalDescription>{description}</ModalDescription>
      </ModalHeader>
      <ModalFooter>
        <button
          onClick={onClose}
          disabled={loading}
          className="
            px-4 py-2 text-sm font-medium rounded-lg
            text-gray-700 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-slate-700
            transition-colors
            disabled:opacity-50
          "
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`
            px-4 py-2 text-sm font-medium rounded-lg
            transition-colors
            disabled:opacity-50
            ${variantStyles[variant]}
          `}
        >
          {loading ? 'Loading...' : confirmText}
        </button>
      </ModalFooter>
    </Modal>
  );
};

/**
 * AlertModal - Pre-built alert/info modal
 */
const AlertModal = ({
  isOpen,
  onClose,
  title = 'Alert',
  description,
  buttonText = 'OK',
  variant = 'info'
}) => {
  const iconVariants = {
    info: (
      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    success: (
      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    warning: (
      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    ),
    error: (
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    )
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="p-6 text-center">
        <div className="flex justify-center">
          {iconVariants[variant]}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {description}
          </p>
        )}
        <button
          onClick={onClose}
          className="
            w-full px-4 py-2.5 text-sm font-medium rounded-lg
            bg-purple-600 text-white hover:bg-purple-700
            transition-colors
          "
        >
          {buttonText}
        </button>
      </div>
    </Modal>
  );
};

export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ConfirmModal,
  AlertModal
};

export default Modal;

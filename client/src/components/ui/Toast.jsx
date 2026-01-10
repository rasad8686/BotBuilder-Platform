import { forwardRef, createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

/**
 * Toast Component with variants and animations
 * Follows BotBuilder Design System tokens
 */
const Toast = forwardRef(({
  id,
  variant = 'default',
  title,
  description,
  duration = 5000,
  onClose,
  action,
  showCloseButton = true,
  className = '',
  ...props
}, ref) => {
  const variants = {
    default: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-gray-200 dark:border-slate-700',
      icon: null,
      iconColor: ''
    },
    success: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-emerald-200 dark:border-emerald-800/50',
      icon: CheckCircle,
      iconColor: 'text-emerald-500'
    },
    error: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-red-200 dark:border-red-800/50',
      icon: AlertCircle,
      iconColor: 'text-red-500'
    },
    warning: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-amber-200 dark:border-amber-800/50',
      icon: AlertTriangle,
      iconColor: 'text-amber-500'
    },
    info: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-blue-200 dark:border-blue-800/50',
      icon: Info,
      iconColor: 'text-blue-500'
    }
  };

  const { bg, border, icon: Icon, iconColor } = variants[variant];

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.15 } }}
      className={`
        relative w-full max-w-sm
        ${bg} ${border}
        border rounded-xl shadow-lg
        p-4 pr-10
        pointer-events-auto
        ${className}
      `}
      role="alert"
      aria-live="polite"
      {...props}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        {Icon && (
          <div className="flex-shrink-0 mt-0.5">
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </p>
          )}
          {description && (
            <p className={`text-sm text-gray-500 dark:text-gray-400 ${title ? 'mt-1' : ''}`}>
              {description}
            </p>
          )}
          {action && (
            <div className="mt-3">
              {action}
            </div>
          )}
        </div>
      </div>

      {/* Close Button */}
      {showCloseButton && (
        <button
          onClick={() => onClose?.(id)}
          className="
            absolute top-3 right-3
            p-1 rounded-lg
            text-gray-400 hover:text-gray-600
            dark:text-gray-500 dark:hover:text-gray-300
            hover:bg-gray-100 dark:hover:bg-slate-700
            transition-colors
          "
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
});

Toast.displayName = 'Toast';

/**
 * ToastContainer - Container for positioning toasts
 */
const ToastContainer = ({
  toasts = [],
  position = 'top-right',
  onClose
}) => {
  const positions = {
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4'
  };

  const isBottom = position.startsWith('bottom');

  const content = (
    <div
      className={`
        fixed z-[100] ${positions[position]}
        flex flex-col gap-3
        pointer-events-none
        ${isBottom ? 'flex-col-reverse' : ''}
      `}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={onClose}
          />
        ))}
      </AnimatePresence>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return null;
};

/**
 * Toast Context and Provider
 */
const ToastContext = createContext(null);

let toastIdCounter = 0;

const ToastProvider = ({ children, position = 'top-right', maxToasts = 5 }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((options) => {
    const id = ++toastIdCounter;
    const toast = {
      id,
      duration: 5000,
      ...options
    };

    setToasts((prev) => {
      const newToasts = [...prev, toast];
      // Limit max toasts
      if (newToasts.length > maxToasts) {
        return newToasts.slice(-maxToasts);
      }
      return newToasts;
    });

    // Auto remove after duration
    if (toast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }

    return id;
  }, [maxToasts]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const toast = useCallback((options) => {
    if (typeof options === 'string') {
      return addToast({ description: options });
    }
    return addToast(options);
  }, [addToast]);

  toast.success = useCallback((options) => {
    if (typeof options === 'string') {
      return addToast({ variant: 'success', description: options });
    }
    return addToast({ variant: 'success', ...options });
  }, [addToast]);

  toast.error = useCallback((options) => {
    if (typeof options === 'string') {
      return addToast({ variant: 'error', description: options });
    }
    return addToast({ variant: 'error', ...options });
  }, [addToast]);

  toast.warning = useCallback((options) => {
    if (typeof options === 'string') {
      return addToast({ variant: 'warning', description: options });
    }
    return addToast({ variant: 'warning', ...options });
  }, [addToast]);

  toast.info = useCallback((options) => {
    if (typeof options === 'string') {
      return addToast({ variant: 'info', description: options });
    }
    return addToast({ variant: 'info', ...options });
  }, [addToast]);

  toast.dismiss = removeToast;
  toast.dismissAll = removeAllToasts;

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer
        toasts={toasts}
        position={position}
        onClose={removeToast}
      />
    </ToastContext.Provider>
  );
};

/**
 * useToast Hook
 */
const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * Standalone toast function for use outside React context
 * Note: This requires ToastProvider to be mounted
 */
let globalToastHandler = null;

const setGlobalToastHandler = (handler) => {
  globalToastHandler = handler;
};

const globalToast = (options) => {
  if (globalToastHandler) {
    return globalToastHandler(options);
  }
  console.warn('Toast: No ToastProvider found. Make sure to wrap your app with ToastProvider.');
};

globalToast.success = (options) => globalToast({ variant: 'success', ...(typeof options === 'string' ? { description: options } : options) });
globalToast.error = (options) => globalToast({ variant: 'error', ...(typeof options === 'string' ? { description: options } : options) });
globalToast.warning = (options) => globalToast({ variant: 'warning', ...(typeof options === 'string' ? { description: options } : options) });
globalToast.info = (options) => globalToast({ variant: 'info', ...(typeof options === 'string' ? { description: options } : options) });

/**
 * Enhanced ToastProvider that exposes global toast handler
 */
const GlobalToastProvider = ({ children, ...props }) => {
  return (
    <ToastProvider {...props}>
      <ToastHandlerSetup />
      {children}
    </ToastProvider>
  );
};

const ToastHandlerSetup = () => {
  const toast = useToast();
  setGlobalToastHandler(toast);
  return null;
};

export {
  Toast,
  ToastContainer,
  ToastProvider,
  GlobalToastProvider,
  useToast,
  globalToast
};

export default Toast;

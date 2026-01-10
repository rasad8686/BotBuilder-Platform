/**
 * Survey Performance Utilities
 * Lazy loading, memoization, and caching components
 */

import React, {
  Suspense,
  lazy,
  memo,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState
} from 'react';
import { LoadingSpinner, CardSkeleton } from './SurveySkeletons';

// ==================== Lazy Loading ====================

// Lazy load heavy chart components
export const LazyCharts = {
  ResponseTrendChart: lazy(() => import('./ResponseTrendChart')),
  NPSBreakdownChart: lazy(() => import('./NPSBreakdownChart')),
  QuestionAnalytics: lazy(() => import('./QuestionAnalytics'))
};

// Suspense wrapper with fallback
export const SuspenseWrapper = ({
  children,
  fallback = <CardSkeleton />,
  className = ''
}) => (
  <Suspense fallback={fallback}>
    <div className={className}>{children}</div>
  </Suspense>
);

// Intersection Observer based lazy loading
export const LazyLoad = ({
  children,
  placeholder = <CardSkeleton />,
  rootMargin = '100px',
  threshold = 0.1,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : placeholder}
    </div>
  );
};

// ==================== Memoization Utilities ====================

// Memoized List Item
export const MemoizedListItem = memo(({
  id,
  title,
  subtitle,
  onClick,
  selected,
  rightContent
}) => (
  <div
    onClick={() => onClick?.(id)}
    className={`
      p-4 rounded-lg cursor-pointer transition-colors
      ${selected
        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
        : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
      }
      border border-gray-200 dark:border-gray-700
    `}
  >
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
      {rightContent}
    </div>
  </div>
), (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.title === nextProps.title &&
    prevProps.subtitle === nextProps.subtitle &&
    prevProps.selected === nextProps.selected
  );
});

// Memoized Chart Component
export const MemoizedChart = memo(({ data, type, options }) => {
  // Chart rendering logic would go here
  return (
    <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <span className="text-gray-500">Chart: {type}</span>
    </div>
  );
}, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});

// ==================== Custom Hooks for Performance ====================

// Debounced value hook
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// Throttled callback hook
export const useThrottle = (callback, delay = 300) => {
  const lastCall = useRef(0);

  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    }
  }, [callback, delay]);
};

// Previous value hook (for comparison)
export const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
};

// ==================== Caching ====================

// Simple in-memory cache
class SimpleCache {
  constructor(maxSize = 100, ttl = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  set(key, value) {
    // Remove oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  clear() {
    this.cache.clear();
  }

  has(key) {
    return this.get(key) !== null;
  }
}

// Singleton cache instance
export const surveyCache = new SimpleCache();

// Hook for cached API calls
export const useCachedFetch = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { cacheKey = url, ttl = 5 * 60 * 1000, skip = false } = options;

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = surveyCache.get(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url, options);
        const json = await response.json();

        if (json.success) {
          surveyCache.set(cacheKey, json);
          setData(json);
        } else {
          setError(new Error(json.error || 'Failed to fetch'));
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url, cacheKey, skip]);

  const refetch = useCallback(() => {
    surveyCache.cache.delete(cacheKey);
    setLoading(true);
    // Trigger re-fetch by changing dependency
  }, [cacheKey]);

  return { data, loading, error, refetch };
};

// ==================== Virtual List ====================

// Virtual list for large datasets
export const VirtualList = ({
  items,
  itemHeight,
  windowHeight,
  renderItem,
  className = ''
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(windowHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      index: startIndex + index
    }));
  }, [items, startIndex, endIndex]);

  const handleScroll = useThrottle((e) => {
    setScrollTop(e.target.scrollTop);
  }, 16);

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-auto ${className}`}
      style={{ height: windowHeight }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item) => (
            <div key={item.index} style={{ height: itemHeight }}>
              {renderItem(item, item.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== Batch Updates ====================

// Batch state updates
export const useBatchedUpdates = (initialState) => {
  const [state, setState] = useState(initialState);
  const pendingUpdates = useRef([]);
  const timeoutRef = useRef(null);

  const batchedSetState = useCallback((update) => {
    pendingUpdates.current.push(update);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setState((prevState) => {
        return pendingUpdates.current.reduce((acc, updateFn) => {
          if (typeof updateFn === 'function') {
            return { ...acc, ...updateFn(acc) };
          }
          return { ...acc, ...updateFn };
        }, prevState);
      });
      pendingUpdates.current = [];
    }, 0);
  }, []);

  return [state, batchedSetState];
};

// ==================== Performance Monitoring ====================

// Simple performance logger (dev only)
export const usePerformanceMonitor = (componentName) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      renderCount.current++;
      const now = Date.now();
      const timeSinceLastRender = now - lastRenderTime.current;
      lastRenderTime.current = now;

      if (renderCount.current > 1) {
        console.debug(
          `[Performance] ${componentName} rendered ${renderCount.current} times. ` +
          `Time since last: ${timeSinceLastRender}ms`
        );
      }
    }
  });
};

// ==================== Exports ====================

export default {
  LazyCharts,
  SuspenseWrapper,
  LazyLoad,
  MemoizedListItem,
  MemoizedChart,
  useDebounce,
  useThrottle,
  usePrevious,
  surveyCache,
  useCachedFetch,
  VirtualList,
  useBatchedUpdates,
  usePerformanceMonitor
};

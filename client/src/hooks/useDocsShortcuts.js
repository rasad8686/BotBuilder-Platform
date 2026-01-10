import { useEffect, useCallback } from 'react';

/**
 * Custom hook for documentation keyboard shortcuts
 * @param {Object} options - Shortcut configuration
 * @param {Function} options.onSearch - Callback for Ctrl+K (open search)
 * @param {Function} options.onPrevious - Callback for Alt+Left (previous page)
 * @param {Function} options.onNext - Callback for Alt+Right (next page)
 * @param {Function} options.onToggleSidebar - Callback for Ctrl+B (toggle sidebar)
 * @param {Function} options.onToggleDarkMode - Callback for Ctrl+D (toggle dark mode)
 * @param {Function} options.onScrollToTop - Callback for Home key
 * @param {Function} options.onCopyLink - Callback for Ctrl+L (copy link)
 */
export default function useDocsShortcuts({
  onSearch,
  onPrevious,
  onNext,
  onToggleSidebar,
  onToggleDarkMode,
  onScrollToTop,
  onCopyLink
}) {
  const handleKeyDown = useCallback((e) => {
    // Ignore if user is typing in an input/textarea
    const target = e.target;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Only allow Escape to close search
      if (e.key === 'Escape') {
        return;
      }
      return;
    }

    // Ctrl/Cmd + K: Open search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      onSearch?.();
      return;
    }

    // Ctrl/Cmd + B: Toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      onToggleSidebar?.();
      return;
    }

    // Ctrl/Cmd + D: Toggle dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      onToggleDarkMode?.();
      return;
    }

    // Ctrl/Cmd + L: Copy current page link
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      onCopyLink?.();
      return;
    }

    // Alt + Left Arrow: Previous page
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      onPrevious?.();
      return;
    }

    // Alt + Right Arrow: Next page
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      onNext?.();
      return;
    }

    // Home: Scroll to top
    if (e.key === 'Home' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      onScrollToTop?.();
      return;
    }

    // Slash: Focus search (like GitHub)
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      onSearch?.();
      return;
    }
  }, [onSearch, onPrevious, onNext, onToggleSidebar, onToggleDarkMode, onScrollToTop, onCopyLink]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return a helper to show available shortcuts
  return {
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Open search', action: 'search' },
      { keys: ['/'], description: 'Focus search', action: 'search' },
      { keys: ['Ctrl', 'B'], description: 'Toggle sidebar', action: 'toggleSidebar' },
      { keys: ['Ctrl', 'D'], description: 'Toggle dark mode', action: 'toggleDarkMode' },
      { keys: ['Ctrl', 'L'], description: 'Copy page link', action: 'copyLink' },
      { keys: ['Alt', '←'], description: 'Previous page', action: 'previous' },
      { keys: ['Alt', '→'], description: 'Next page', action: 'next' },
      { keys: ['Home'], description: 'Scroll to top', action: 'scrollTop' },
      { keys: ['Esc'], description: 'Close modal', action: 'close' }
    ]
  };
}

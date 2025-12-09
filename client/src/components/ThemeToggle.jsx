import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * iOS-style Theme Toggle Switch
 * Professional pill container (56px x 28px) with sun/moon icons inside
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '56px',
        height: '28px',
        padding: '0 6px',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: isDark ? '#334155' : '#e2e8f0',
        transition: 'background-color 0.3s ease',
        outline: 'none',
        overflow: 'hidden'
      }}
      className={className}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Sun icon - left side */}
      <Sun
        size={14}
        style={{
          color: isDark ? '#64748b' : '#f59e0b',
          transition: 'color 0.3s ease',
          zIndex: 1,
          flexShrink: 0
        }}
        strokeWidth={2.5}
      />

      {/* Moon icon - right side */}
      <Moon
        size={14}
        style={{
          color: isDark ? '#a78bfa' : '#94a3b8',
          transition: 'color 0.3s ease',
          zIndex: 1,
          flexShrink: 0
        }}
        strokeWidth={2.5}
      />

      {/* Sliding circle indicator */}
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: isDark ? '30px' : '2px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          transition: 'left 0.3s ease',
          zIndex: 2
        }}
      />
    </button>
  );
}

/**
 * Compact iOS-style toggle for tight spaces
 */
export function ThemeToggleCompact({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '44px',
        height: '24px',
        padding: '0 5px',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: isDark ? '#334155' : '#e2e8f0',
        transition: 'background-color 0.3s ease',
        outline: 'none',
        overflow: 'hidden'
      }}
      className={className}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Sun icon - left side */}
      <Sun
        size={11}
        style={{
          color: isDark ? '#64748b' : '#f59e0b',
          transition: 'color 0.3s ease',
          zIndex: 1,
          flexShrink: 0
        }}
        strokeWidth={2.5}
      />

      {/* Moon icon - right side */}
      <Moon
        size={11}
        style={{
          color: isDark ? '#a78bfa' : '#94a3b8',
          transition: 'color 0.3s ease',
          zIndex: 1,
          flexShrink: 0
        }}
        strokeWidth={2.5}
      />

      {/* Sliding circle indicator */}
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: isDark ? '22px' : '2px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          transition: 'left 0.3s ease',
          zIndex: 2
        }}
      />
    </button>
  );
}

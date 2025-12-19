/**
 * Theme System
 * Complete theme configuration with colors, fonts, spacing, shadows
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key
const THEME_STORAGE_KEY = '@botbuilder/theme';

/**
 * Color Palette
 */
export const palette = {
  // Primary (Indigo)
  primary: {
    50: '#e0e7ff',
    100: '#c7d2fe',
    200: '#a5b4fc',
    300: '#818cf8',
    400: '#6366f1',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },

  // Secondary (Slate)
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Success (Green)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  // Warning (Amber)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Error (Red)
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Info (Blue)
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Neutral
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

/**
 * Spacing Scale
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
  '7xl': 80,
  '8xl': 96,
};

/**
 * Border Radius
 */
export const borderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
};

/**
 * Typography
 */
export const typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },

  // Font sizes
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 40,
    '7xl': 48,
  },

  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
};

/**
 * Shadows
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 16,
  },
  colored: (color, opacity = 0.3) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: opacity,
    shadowRadius: 8,
    elevation: 4,
  }),
};

/**
 * Animation Timing
 */
export const animation = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 300,
    slow: 500,
    slower: 700,
  },
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
};

/**
 * Z-Index Scale
 */
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
  max: 9999,
};

/**
 * Light Theme Colors
 */
export const lightColors = {
  // Background
  background: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
    inverse: '#1e293b',
  },

  // Text
  text: {
    primary: '#1e293b',
    secondary: '#64748b',
    tertiary: '#94a3b8',
    inverse: '#ffffff',
    disabled: '#cbd5e1',
  },

  // Border
  border: {
    default: '#e2e8f0',
    light: '#f1f5f9',
    focus: '#6366f1',
  },

  // Status colors
  primary: palette.primary[500],
  primaryLight: palette.primary[50],
  primaryDark: palette.primary[700],

  success: palette.success[500],
  successLight: palette.success[50],
  successDark: palette.success[700],

  warning: palette.warning[500],
  warningLight: palette.warning[50],
  warningDark: palette.warning[700],

  error: palette.error[500],
  errorLight: palette.error[50],
  errorDark: palette.error[700],

  info: palette.info[500],
  infoLight: palette.info[50],
  infoDark: palette.info[700],

  // Component-specific
  card: {
    background: '#ffffff',
    border: '#e2e8f0',
  },
  input: {
    background: '#f1f5f9',
    border: '#e2e8f0',
    focusBorder: '#6366f1',
    placeholder: '#94a3b8',
  },
  button: {
    primary: '#6366f1',
    primaryText: '#ffffff',
    secondary: '#f1f5f9',
    secondaryText: '#475569',
    disabled: '#e2e8f0',
    disabledText: '#94a3b8',
  },
  tabBar: {
    background: '#ffffff',
    active: '#6366f1',
    inactive: '#94a3b8',
    border: '#f1f5f9',
  },
  statusBar: 'dark-content',
};

/**
 * Theme Context
 */
const ThemeContext = createContext(null);

/**
 * Theme Provider
 */
export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system'); // 'light', 'dark', 'system'
  const [colors, setColors] = useState(lightColors);

  // Load saved theme preference
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Update colors when theme mode or system theme changes
  useEffect(() => {
    updateColors();

    // Listen for system theme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === 'system') {
        updateColors();
      }
    });

    return () => subscription?.remove();
  }, [themeMode, systemColorScheme]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme) {
        setThemeMode(savedTheme);
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
    }
  };

  const updateColors = () => {
    const isDark =
      themeMode === 'dark' ||
      (themeMode === 'system' && systemColorScheme === 'dark');

    if (isDark) {
      // Import dark theme dynamically to avoid circular dependencies
      const { darkColors } = require('./darkTheme');
      setColors(darkColors);
    } else {
      setColors(lightColors);
    }
  };

  const setTheme = useCallback(async (mode) => {
    setThemeMode(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    setTheme(newMode);
  }, [themeMode, setTheme]);

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemColorScheme === 'dark');

  const value = {
    // Current theme state
    themeMode,
    isDark,
    colors,

    // Theme setters
    setTheme,
    toggleTheme,
    setLightTheme: () => setTheme('light'),
    setDarkTheme: () => setTheme('dark'),
    setSystemTheme: () => setTheme('system'),

    // Design tokens
    palette,
    spacing,
    borderRadius,
    typography,
    shadows,
    animation,
    zIndex,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * useTheme Hook
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * useColors Hook - just the colors
 */
export const useColors = () => {
  const { colors } = useTheme();
  return colors;
};

/**
 * useIsDark Hook - just the dark mode check
 */
export const useIsDark = () => {
  const { isDark } = useTheme();
  return isDark;
};

/**
 * Styled helper for dynamic styling
 */
export const styled = (baseStyles, darkStyles) => {
  return (isDark) => ({
    ...baseStyles,
    ...(isDark ? darkStyles : {}),
  });
};

/**
 * Create themed styles helper
 */
export const createThemedStyles = (stylesFn) => {
  return () => {
    const theme = useTheme();
    return stylesFn(theme);
  };
};

export default {
  ThemeProvider,
  useTheme,
  useColors,
  useIsDark,
  palette,
  spacing,
  borderRadius,
  typography,
  shadows,
  animation,
  zIndex,
  lightColors,
  styled,
  createThemedStyles,
};

/**
 * Dark Theme Colors
 * Complete dark mode color palette
 */
import { palette } from './index';

/**
 * Dark Theme Colors
 */
export const darkColors = {
  // Background
  background: {
    primary: '#0f172a',
    secondary: '#1e293b',
    tertiary: '#334155',
    inverse: '#f8fafc',
  },

  // Text
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    tertiary: '#64748b',
    inverse: '#1e293b',
    disabled: '#475569',
  },

  // Border
  border: {
    default: '#334155',
    light: '#1e293b',
    focus: '#818cf8',
  },

  // Status colors (slightly brighter for dark mode)
  primary: palette.primary[400],
  primaryLight: 'rgba(99, 102, 241, 0.15)',
  primaryDark: palette.primary[300],

  success: palette.success[400],
  successLight: 'rgba(34, 197, 94, 0.15)',
  successDark: palette.success[300],

  warning: palette.warning[400],
  warningLight: 'rgba(245, 158, 11, 0.15)',
  warningDark: palette.warning[300],

  error: palette.error[400],
  errorLight: 'rgba(239, 68, 68, 0.15)',
  errorDark: palette.error[300],

  info: palette.info[400],
  infoLight: 'rgba(59, 130, 246, 0.15)',
  infoDark: palette.info[300],

  // Component-specific
  card: {
    background: '#1e293b',
    border: '#334155',
  },
  input: {
    background: '#1e293b',
    border: '#334155',
    focusBorder: '#818cf8',
    placeholder: '#64748b',
  },
  button: {
    primary: '#818cf8',
    primaryText: '#0f172a',
    secondary: '#334155',
    secondaryText: '#e2e8f0',
    disabled: '#334155',
    disabledText: '#64748b',
  },
  tabBar: {
    background: '#1e293b',
    active: '#818cf8',
    inactive: '#64748b',
    border: '#334155',
  },
  statusBar: 'light-content',
};

/**
 * Dark mode shadows (softer)
 */
export const darkShadows = {
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
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 16,
  },
};

/**
 * Dark theme gradients
 */
export const darkGradients = {
  primary: ['#6366f1', '#818cf8'],
  success: ['#22c55e', '#4ade80'],
  warning: ['#f59e0b', '#fbbf24'],
  error: ['#ef4444', '#f87171'],
  info: ['#3b82f6', '#60a5fa'],
  background: ['#0f172a', '#1e293b'],
  card: ['#1e293b', '#334155'],
};

/**
 * Dark theme specific component styles
 */
export const darkComponentStyles = {
  // Header
  header: {
    backgroundColor: '#1e293b',
    borderBottomColor: '#334155',
    titleColor: '#f8fafc',
    iconColor: '#94a3b8',
  },

  // Navigation
  navigation: {
    tabBarBackground: '#1e293b',
    tabBarBorder: '#334155',
    activeColor: '#818cf8',
    inactiveColor: '#64748b',
    indicatorColor: '#818cf8',
  },

  // List
  list: {
    backgroundColor: '#0f172a',
    itemBackground: '#1e293b',
    separatorColor: '#334155',
    selectedBackground: 'rgba(99, 102, 241, 0.15)',
  },

  // Modal
  modal: {
    overlayColor: 'rgba(0, 0, 0, 0.7)',
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },

  // Toast
  toast: {
    backgroundColor: '#334155',
    textColor: '#f8fafc',
    borderColor: '#475569',
  },

  // Badge
  badge: {
    backgroundColor: '#ef4444',
    textColor: '#ffffff',
    borderColor: '#1e293b',
  },

  // Avatar
  avatar: {
    backgroundColor: '#334155',
    textColor: '#f8fafc',
    borderColor: '#475569',
  },

  // Skeleton
  skeleton: {
    backgroundColor: '#334155',
    shimmerColor: 'rgba(255, 255, 255, 0.05)',
  },

  // Switch
  switch: {
    trackOff: '#475569',
    trackOn: '#818cf8',
    thumbOff: '#94a3b8',
    thumbOn: '#f8fafc',
  },

  // Checkbox
  checkbox: {
    unchecked: '#475569',
    checked: '#818cf8',
    checkmark: '#0f172a',
  },

  // Slider
  slider: {
    track: '#334155',
    fill: '#818cf8',
    thumb: '#f8fafc',
  },

  // Progress
  progress: {
    track: '#334155',
    fill: '#818cf8',
  },

  // Divider
  divider: {
    color: '#334155',
  },
};

/**
 * Helper to get dark theme value with fallback
 */
export const getDarkValue = (path, fallback = null) => {
  const keys = path.split('.');
  let value = darkColors;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return fallback;
    }
  }

  return value;
};

/**
 * Create dark mode styles from light mode styles
 */
export const createDarkStyles = (lightStyles, overrides = {}) => {
  const darkStyles = {};

  for (const key in lightStyles) {
    const style = lightStyles[key];
    darkStyles[key] = { ...style };

    // Auto-convert common color properties
    if (style.backgroundColor === '#ffffff') {
      darkStyles[key].backgroundColor = darkColors.background.primary;
    } else if (style.backgroundColor === '#f8fafc') {
      darkStyles[key].backgroundColor = darkColors.background.secondary;
    } else if (style.backgroundColor === '#f1f5f9') {
      darkStyles[key].backgroundColor = darkColors.background.tertiary;
    }

    if (style.color === '#1e293b') {
      darkStyles[key].color = darkColors.text.primary;
    } else if (style.color === '#64748b') {
      darkStyles[key].color = darkColors.text.secondary;
    } else if (style.color === '#94a3b8') {
      darkStyles[key].color = darkColors.text.tertiary;
    }

    if (style.borderColor === '#e2e8f0') {
      darkStyles[key].borderColor = darkColors.border.default;
    } else if (style.borderColor === '#f1f5f9') {
      darkStyles[key].borderColor = darkColors.border.light;
    }
  }

  // Apply overrides
  for (const key in overrides) {
    darkStyles[key] = { ...darkStyles[key], ...overrides[key] };
  }

  return darkStyles;
};

export default {
  darkColors,
  darkShadows,
  darkGradients,
  darkComponentStyles,
  getDarkValue,
  createDarkStyles,
};

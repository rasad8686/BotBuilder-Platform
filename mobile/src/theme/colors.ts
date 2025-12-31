export const colors = {
  // Primary Colors
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },

  // Secondary Colors
  secondary: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },

  // Neutral Colors
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Status Colors
  success: {
    light: '#86efac',
    main: '#22c55e',
    dark: '#16a34a',
  },

  warning: {
    light: '#fde047',
    main: '#eab308',
    dark: '#ca8a04',
  },

  error: {
    light: '#fca5a5',
    main: '#ef4444',
    dark: '#dc2626',
  },

  info: {
    light: '#93c5fd',
    main: '#3b82f6',
    dark: '#2563eb',
  },

  // Platform Colors
  platforms: {
    telegram: '#0088cc',
    discord: '#5865F2',
    slack: '#4A154B',
    whatsapp: '#25D366',
    web: '#6366f1',
  },

  // Special Colors
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const lightTheme = {
  background: {
    primary: '#ffffff',
    secondary: '#f5f5f5',
    tertiary: '#e5e5e5',
  },
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#737373',
    inverse: '#ffffff',
  },
  border: {
    light: '#e5e5e5',
    medium: '#d4d4d4',
    dark: '#a3a3a3',
  },
  card: {
    background: '#ffffff',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  input: {
    background: '#f5f5f5',
    border: '#e5e5e5',
    placeholder: '#a3a3a3',
  },
  ...colors,
};

export const darkTheme = {
  background: {
    primary: '#0a0a0a',
    secondary: '#171717',
    tertiary: '#262626',
  },
  text: {
    primary: '#fafafa',
    secondary: '#a3a3a3',
    tertiary: '#737373',
    inverse: '#171717',
  },
  border: {
    light: '#262626',
    medium: '#404040',
    dark: '#525252',
  },
  card: {
    background: '#171717',
    shadow: 'rgba(0, 0, 0, 0.5)',
  },
  input: {
    background: '#262626',
    border: '#404040',
    placeholder: '#737373',
  },
  ...colors,
};

export type Theme = typeof lightTheme;

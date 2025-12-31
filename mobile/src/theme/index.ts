export * from './colors';
export * from './spacing';

import { lightTheme, darkTheme, type Theme } from './colors';
import { spacing, borderRadius, fontSize, fontWeight, lineHeight, iconSize, hitSlop } from './spacing';

export const themes = {
  light: {
    ...lightTheme,
    spacing,
    borderRadius,
    fontSize,
    fontWeight,
    lineHeight,
    iconSize,
    hitSlop,
  },
  dark: {
    ...darkTheme,
    spacing,
    borderRadius,
    fontSize,
    fontWeight,
    lineHeight,
    iconSize,
    hitSlop,
  },
};

export type AppTheme = typeof themes.light;

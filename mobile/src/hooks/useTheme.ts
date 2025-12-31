import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { useSettingsStore } from '../store';
import { themes, type AppTheme } from '../theme';

export function useTheme(): AppTheme {
  const systemColorScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.theme);

  const theme = useMemo(() => {
    if (themePreference === 'system') {
      return systemColorScheme === 'dark' ? themes.dark : themes.light;
    }
    return themePreference === 'dark' ? themes.dark : themes.light;
  }, [themePreference, systemColorScheme]);

  return theme;
}

export function useIsDarkMode(): boolean {
  const systemColorScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.theme);

  return useMemo(() => {
    if (themePreference === 'system') {
      return systemColorScheme === 'dark';
    }
    return themePreference === 'dark';
  }, [themePreference, systemColorScheme]);
}

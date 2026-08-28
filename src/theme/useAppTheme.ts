import { useColorScheme } from 'react-native';

import { darkColors, lightColors, radius, spacing, typography } from './tokens';

export function useAppTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    radius,
    spacing,
    typography,
  };
}

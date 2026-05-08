import { useColorScheme as useRNColorScheme } from 'react-native';

export type ThemeColorScheme = 'light' | 'dark';

export function useColorScheme(): ThemeColorScheme {
  const colorScheme = useRNColorScheme();

  return colorScheme === 'dark' ? 'dark' : 'light';
}

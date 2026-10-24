import { useColorScheme } from 'react-native';

// Semantic values from WETOP design/tokens.json, native rendering adapter.
export const themes = {
  light: { background: '#e9f0f8', surface: '#ffffff', muted: '#f6f8fc', text: '#101827', secondary: '#536176', primary: '#085fba', primarySoft: '#eaf4ff', onPrimary: '#ffffff', border: '#8596af', danger: '#c53147' },
  dark: { background: '#060b14', surface: '#0b1524', muted: '#0d192a', text: '#f7f9fc', secondary: '#a8b3c5', primary: '#48a5ff', primarySoft: '#102c49', onPrimary: '#06111f', border: '#899ab1', danger: '#ff7a87' },
} as const;

export function useTheme() {
  return themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

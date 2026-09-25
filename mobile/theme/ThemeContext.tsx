import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme, ColorSchemeName } from 'react-native';
import { Colors, type ColorScheme, type ColorTokens } from './Colors';

type ThemeColors = ColorTokens & typeof Colors.light;

interface ThemeContextValue {
  scheme: ColorScheme;
  colors: ThemeColors;
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme() ?? 'dark';
  const [scheme, setScheme] = useState<ColorScheme>('dark');

  useEffect(() => {
    if (systemScheme === 'dark' || systemScheme === 'light') {
      setScheme(systemScheme);
    }
  }, [systemScheme]);

  const toggleScheme = () => {
    setScheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value: ThemeContextValue = {
    scheme,
    colors: Colors[scheme] as ThemeColors,
    setScheme,
    toggleScheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
import React from 'react';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from './theme/ThemeContext';
import RootLayout from './app/_layout';

export default function App() {
  return (
    <ThemeProvider>
      <RootLayout />
    </ThemeProvider>
  );
}
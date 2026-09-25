export const Colors = {
  dark: {
    // Base
    background: '#1A1A1D',
    surface: '#202024',
    surfaceElevated: '#2A2A2F',
    elevated: '#2A2A2F',
    card: '#232328',
    // Text
    text: '#F0F0EB',
    textSecondary: '#B8B8B0',
    textMuted: '#888880',
    textFaint: '#666660',
    // Accent
    accent: '#C9B8FF',
    accentSoft: '#3A3050',
    accentPressed: '#A890E8',
    // Borders
    border: '#3A3A3E',
    borderSubtle: '#2E2E32',
    // Semantic
    success: '#4ECDC4',
    warning: '#FFB86C',
    error: '#FF6B6B',
    muted: '#888880',
    // Reader
    readingBackground: '#1C1C20',
    readingText: '#E8E4D8',
    readingMuted: '#A09C90',
  },
  light: {
    // Base
    background: '#F8F8F5',
    surface: '#FFFFFF',
    surfaceElevated: '#F0F0EB',
    elevated: '#F0F0EB',
    card: '#FAFAF8',
    // Text
    text: '#1A1A18',
    textSecondary: '#5A5A56',
    textMuted: '#888884',
    textFaint: '#AAAAA8',
    // Accent
    accent: '#7C5CFF',
    accentSoft: '#F0EBFF',
    accentPressed: '#5A3DE8',
    // Borders
    border: '#E0E0DC',
    borderSubtle: '#E8E8E4',
    // Semantic
    success: '#00A898',
    warning: '#D48800',
    error: '#D84040',
    muted: '#888884',
    // Reader
    readingBackground: '#FBFAF5',
    readingText: '#2D2B26',
    readingMuted: '#7A7872',
  },
} as const;

export type ColorScheme = 'dark' | 'light';
export type ColorTokens = typeof Colors.dark;
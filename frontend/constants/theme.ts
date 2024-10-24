export const darkTheme = {
  colors: {
    background: '#000000', // Pure black for OLED screens
    surface: '#1C1C1E', // Dark surface color
    surfaceVariant: '#2C2C2C', // Alternative surface color
    primary: '#BB86FC', // Primary brand color
    primaryVariant: '#3700B3', // Variant of primary color
    secondary: '#03DAC6', // Secondary brand color
    accent: '#CF6679', // Accent color for emphasis
    text: '#FFFFFF', // Primary text
    textSecondary: 'rgba(255, 255, 255, 0.7)', // Secondary text
    textTertiary: 'rgba(255, 255, 255, 0.5)', // Disabled text
    border: 'rgba(255, 255, 255, 0.12)', // Border color
    success: '#4CAF50',  // Green
    error: '#F44336',    // Red
    warning: '#FF9800',  // Orange
    info: '#2196F3',     // Blue
    white: '#FFFFFF',
    chart: {
      primary: '#BB86FC',
      secondary: '#03DAC6',
      tertiary: '#CF6679',
      background: 'rgba(187, 134, 252, 0.1)',
    },
    elevation: {
      1: 'rgba(0, 0, 0, 0.05)',
      2: 'rgba(0, 0, 0, 0.08)',
      3: 'rgba(0, 0, 0, 0.12)',
    },
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    s: 4,
    m: 8,
    l: 16,
    xl: 24,
    xxl: 32,
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: 'bold',
    },
    h2: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    h3: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    body1: {
      fontSize: 16,
    },
    body2: {
      fontSize: 14,
    },
    caption: {
      fontSize: 12,
    },
  },
  animation: {
    short: 200,
    medium: 300,
    long: 500,
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.37,
      shadowRadius: 7.49,
      elevation: 8,
    },
  },
};

export type Theme = typeof darkTheme;

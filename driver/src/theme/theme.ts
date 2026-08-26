// Zana Ride design tokens
// Brand colors as defined in the product spec

export const colors = {
  primary: '#00A082',
  primaryDark: '#00806A',
  primaryLight: '#E3F5F1',
  secondary: '#FFC244',
  secondaryDark: '#E6A82E',

  white: '#FFFFFF',
  surface: '#F7F8F8',
  ink: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',

  success: '#12B76A',
  error: '#F04438',
  warning: '#FFC244',

  overlay: 'rgba(17, 24, 39, 0.45)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.ink },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.ink },
  h3: { fontSize: 18, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.ink },
  bodyMuted: { fontSize: 14, fontWeight: '400' as const, color: colors.muted },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.muted },
  button: { fontSize: 16, fontWeight: '600' as const, color: colors.white },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};

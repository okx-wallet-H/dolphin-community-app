import type { TextStyle, ViewStyle } from 'react-native';

export const ManusColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F7',
  surfaceTint: '#F1EDFF',
  primary: '#6B4EFF',
  primaryLight: '#8B6FFF',
  text: '#1A1A2E',
  muted: '#8E8E93',
  tabMuted: '#8E8E93',
  success: '#10B981',
  danger: '#EF4444',
  divider: '#F0F0F4',
} as const;

export const ManusSpacing = {
  page: 20,
  card: 16,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const ManusRadius = {
  card: 16,
  control: 16,
  input: 16,
  button: 16,
  pill: 999,
  tag: 12,
  avatar: 999,
} as const;

export const ManusShadow: ViewStyle = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 12,
  elevation: 3,
};

export const ManusEmphasisShadow: ViewStyle = {
  shadowColor: '#6B4EFF',
  shadowOpacity: 0.1,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 16,
  elevation: 5,
};

export const ManusTypography = {
  heroTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    color: ManusColors.text,
  } satisfies TextStyle,
  brandTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    color: ManusColors.text,
  } satisfies TextStyle,
  pageTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: ManusColors.text,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: ManusColors.text,
  } satisfies TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: ManusColors.text,
  } satisfies TextStyle,
  secondary: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: ManusColors.muted,
  } satisfies TextStyle,
  caption: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
    color: ManusColors.muted,
  } satisfies TextStyle,
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  } satisfies TextStyle,
} as const;

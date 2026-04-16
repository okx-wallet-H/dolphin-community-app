import type { TextStyle, ViewStyle } from "react-native";

export const ManusColors = {
  background: "#F5F5F7",
  surface: "#FFFFFF",
  surfaceAlt: "#ECECF1",
  surfaceTint: "#EEE9FF",
  glass: "rgba(255,255,255,0.72)",
  primary: "#6E5BFF",
  primaryLight: "#8B80FF",
  text: "#111827",
  textSecondary: "#475467",
  muted: "#667085",
  tabMuted: "#98A2B3",
  success: "#12B981",
  danger: "#EF4444",
  divider: "rgba(15,23,42,0.08)",
  shadow: "rgba(15,23,42,0.12)",
} as const;

export const ManusSpacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  page: 20,
  card: 16,
} as const;

export const ManusRadius = {
  xs: 10,
  sm: 14,
  card: 22,
  control: 18,
  input: 22,
  button: 18,
  pill: 999,
  tag: 14,
  avatar: 999,
  sheet: 28,
} as const;

export const ManusShadow: ViewStyle = {
  shadowColor: "#0F172A",
  shadowOpacity: 0.06,
  shadowOffset: { width: 0, height: 10 },
  shadowRadius: 24,
  elevation: 4,
};

export const ManusEmphasisShadow: ViewStyle = {
  shadowColor: "#6E5BFF",
  shadowOpacity: 0.12,
  shadowOffset: { width: 0, height: 12 },
  shadowRadius: 28,
  elevation: 6,
};

export const ManusTypography = {
  heroTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700",
    letterSpacing: -0.9,
    color: ManusColors.text,
  } satisfies TextStyle,
  brandTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.7,
    color: ManusColors.text,
  } satisfies TextStyle,
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: ManusColors.text,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: ManusColors.text,
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: ManusColors.text,
  } satisfies TextStyle,
  secondary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: ManusColors.textSecondary,
  } satisfies TextStyle,
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    color: ManusColors.muted,
  } satisfies TextStyle,
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: "#FFFFFF",
  } satisfies TextStyle,
  tab: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: ManusColors.text,
  } satisfies TextStyle,
  numericHero: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -1,
    color: ManusColors.text,
  } satisfies TextStyle,
} as const;

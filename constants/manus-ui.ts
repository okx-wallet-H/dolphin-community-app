import type { TextStyle, ViewStyle } from "react-native";

/* ─────────────────────────────────────────────
 * Dolphin Design System v2 — Pure White + Purple
 * Grok-inspired minimal chat-first aesthetic
 * ───────────────────────────────────────────── */

export const ManusColors = {
  /* Backgrounds */
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F8F7FC",
  surfaceTint: "#F3F0FF",
  glass: "rgba(255,255,255,0.88)",

  /* Brand */
  primary: "#7C3AED",
  primaryLight: "#A78BFA",
  primarySoft: "#EDE9FE",

  /* Text */
  text: "#111827",
  textSecondary: "#6B7280",
  muted: "#9CA3AF",
  tabMuted: "#D1D5DB",

  /* Status */
  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",

  /* Borders & Shadows */
  divider: "rgba(0,0,0,0.06)",
  shadow: "rgba(0,0,0,0.08)",

  /* Card accent tints (each card type gets a unique tint) */
  cardPrice: "#7C3AED",     // purple
  cardAsset: "#3B82F6",     // blue
  cardDefi: "#10B981",      // green
  cardSmartMoney: "#F59E0B",// amber
  cardMeme: "#EC4899",      // pink
  cardSwap: "#06B6D4",      // cyan
  cardTransfer: "#8B5CF6",  // violet
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
  xs: 8,
  sm: 12,
  card: 20,
  control: 16,
  input: 24,
  button: 14,
  pill: 999,
  tag: 12,
  avatar: 999,
  sheet: 24,
} as const;

export const ManusShadow: ViewStyle = {
  shadowColor: "#000",
  shadowOpacity: 0.04,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 8,
  elevation: 2,
};

export const ManusEmphasisShadow: ViewStyle = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.15,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 16,
  elevation: 4,
};

export const ManusTypography = {
  heroTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: ManusColors.text,
  } satisfies TextStyle,
  brandTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: ManusColors.text,
  } satisfies TextStyle,
  pageTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: ManusColors.text,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: ManusColors.text,
  } satisfies TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
    color: ManusColors.text,
  } satisfies TextStyle,
  secondary: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    color: ManusColors.textSecondary,
  } satisfies TextStyle,
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    color: ManusColors.muted,
  } satisfies TextStyle,
  button: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: "#FFFFFF",
  } satisfies TextStyle,
  tab: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: ManusColors.text,
  } satisfies TextStyle,
  numericHero: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: ManusColors.text,
  } satisfies TextStyle,
} as const;

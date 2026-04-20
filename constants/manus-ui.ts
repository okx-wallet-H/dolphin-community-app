import type { TextStyle, ViewStyle } from "react-native";

/**
 * H Wallet Design System v3
 * 淡紫渐变背景 + 玻璃态卡片 + 精致质感
 */

export const ManusColors = {
  // 背景渐变
  bgGradientStart: "#F8F5FF",
  bgGradientMid: "#EDE9FE", 
  bgGradientEnd: "#E0E7FF",
  
  // 玻璃态
  glass: "rgba(255, 255, 255, 0.85)",
  glassBorder: "rgba(255, 255, 255, 0.6)",
  glassLight: "rgba(255, 255, 255, 0.95)",
  glassOverlay: "rgba(255, 255, 255, 0.7)",
  
  // 品牌紫
  primary: "#7C3AED",
  primaryLight: "#A78BFA",
  primaryDark: "#6D28D9",
  primarySoft: "#EDE9FE",
  
  // 文字
  text: "#1F1F3D",
  textSecondary: "#6B7280",
  muted: "#9CA3AF",
  textOnPrimary: "#FFFFFF",
  
  // 状态色
  success: "#10B981",
  successSoft: "#D1FAE5",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  
  // 卡片点缀色
  cardPurple: "rgba(124, 58, 237, 0.1)",
  cardBlue: "rgba(59, 130, 246, 0.1)",
  cardGreen: "rgba(16, 185, 129, 0.1)",
  cardOrange: "rgba(245, 158, 11, 0.1)",
  cardPink: "rgba(236, 72, 153, 0.1)",
  cardCyan: "rgba(6, 182, 212, 0.1)",
  
  // 边框
  border: "rgba(124, 58, 237, 0.1)",
  borderLight: "rgba(255, 255, 255, 0.4)",
  divider: "rgba(0, 0, 0, 0.06)",
  
  // 图标背景色
  iconBgPurple: "rgba(124, 58, 237, 0.12)",
  iconBgBlue: "rgba(59, 130, 246, 0.12)",
  iconBgGreen: "rgba(16, 185, 129, 0.12)",
  iconBgOrange: "rgba(245, 158, 11, 0.12)",
  
  // 兼容旧 API
  surfaceTint: "rgba(124, 58, 237, 0.08)",
  surface: "#FFFFFF",
  background: "#FDFCFF",
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
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  card: 20,
  button: 14,
  input: 16,
  pill: 999,
  avatar: 999,
  // 兼容旧 API
  sheet: 24,
  control: 12,
} as const;

export const ManusShadow: ViewStyle = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 12,
  elevation: 3,
};

export const ManusGlowShadow: ViewStyle = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 20,
  elevation: 6,
};

// 兼容旧 API
export const ManusEmphasisShadow: ViewStyle = {
  shadowColor: "#7C3AED",
  shadowOpacity: 0.15,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 12,
  elevation: 4,
};

export const ManusTypography = {
  // 大金额
  heroAmount: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "700",
    letterSpacing: -1,
    color: ManusColors.text,
  } satisfies TextStyle,
  // 品牌标题
  brandTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: ManusColors.text,
  } satisfies TextStyle,
  // 页面标题
  pageTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: ManusColors.text,
  } satisfies TextStyle,
  // 区块标题
  sectionTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    color: ManusColors.text,
  } satisfies TextStyle,
  // 卡片标题
  cardTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: ManusColors.text,
  } satisfies TextStyle,
  // 正文
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
    color: ManusColors.text,
  } satisfies TextStyle,
  // 辅助文字
  secondary: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: ManusColors.textSecondary,
  } satisfies TextStyle,
  // 小标签
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    color: ManusColors.muted,
  } satisfies TextStyle,
  // 按钮文字
  button: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: ManusColors.textOnPrimary,
  } satisfies TextStyle,
  // 数字
  numeric: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: ManusColors.text,
  } satisfies TextStyle,
  // 小数字
  numericSm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: ManusColors.text,
  } satisfies TextStyle,
  // Tab 文字（兼容旧 API）
  tab: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: ManusColors.text,
  } satisfies TextStyle,
} as const;

// 玻璃卡片样式
export const GlassCardStyle: ViewStyle = {
  backgroundColor: ManusColors.glass,
  borderRadius: ManusRadius.card,
  borderWidth: 1,
  borderColor: ManusColors.glassBorder,
  ...ManusShadow,
};

// 渐变预设
export const GradientPresets = {
  background: [ManusColors.bgGradientStart, ManusColors.bgGradientMid, ManusColors.bgGradientEnd],
  primaryButton: [ManusColors.primary, ManusColors.primaryDark],
  purpleCard: ["#8B5CF6", "#7C3AED"],
} as const;

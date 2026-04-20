/**
 * PremiumCard - 高端精美功能卡片组件
 * 渐变背景 + 图标 + 玻璃态 + 精致阴影
 */
import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ManusColors } from "@/constants/manus-ui";

type CardVariant = "price" | "asset" | "defi" | "smartMoney" | "meme" | "swap" | "transfer";

interface PremiumCardProps {
  variant: CardVariant;
  title: string;
  subtitle?: string;
  badge?: { text: string; positive?: boolean };
  heroValue?: string;
  heroSuffix?: string;
  children?: React.ReactNode;
  actions?: Array<{ label: string; primary?: boolean; onPress: () => void }>;
}

const CARD_CONFIG: Record<CardVariant, { 
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; 
  gradient: [string, string]; 
  iconBg: string;
  accentColor: string;
}> = {
  price: { 
    icon: "chart-line", 
    gradient: ["#F0EBFF", "#E8E0FF"], 
    iconBg: "rgba(124, 58, 237, 0.15)",
    accentColor: "#7C3AED"
  },
  asset: { 
    icon: "wallet-outline", 
    gradient: ["#ECFDF5", "#D1FAE5"], 
    iconBg: "rgba(16, 185, 129, 0.15)",
    accentColor: "#10B981"
  },
  defi: { 
    icon: "percent-outline", 
    gradient: ["#FFF7ED", "#FFEDD5"], 
    iconBg: "rgba(245, 158, 11, 0.15)",
    accentColor: "#F59E0B"
  },
  smartMoney: { 
    icon: "trophy-outline", 
    gradient: ["#FDF2F8", "#FCE7F3"], 
    iconBg: "rgba(236, 72, 153, 0.15)",
    accentColor: "#EC4899"
  },
  meme: { 
    icon: "fire", 
    gradient: ["#FFFBEB", "#FEF3C7"], 
    iconBg: "rgba(245, 158, 11, 0.15)",
    accentColor: "#F59E0B"
  },
  swap: { 
    icon: "swap-horizontal-bold", 
    gradient: ["#EEF2FF", "#E0E7FF"], 
    iconBg: "rgba(99, 102, 241, 0.15)",
    accentColor: "#6366F1"
  },
  transfer: { 
    icon: "send", 
    gradient: ["#ECFEFF", "#CFFAFE"], 
    iconBg: "rgba(6, 182, 212, 0.15)",
    accentColor: "#06B6D4"
  },
};

export function PremiumCard({ variant, title, subtitle, badge, heroValue, heroSuffix, children, actions }: PremiumCardProps) {
  const config = CARD_CONFIG[variant];
  
  return (
    <View style={styles.cardOuter}>
      <LinearGradient
        colors={config.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: config.iconBg }]}>
            <MaterialCommunityIcons name={config.icon} size={20} color={config.accentColor} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.cardTitle}>{title}</Text>
            {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
          </View>
          {badge && (
            <View style={[styles.badge, { backgroundColor: badge.positive ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" }]}>
              <Text style={[styles.badgeText, { color: badge.positive ? "#10B981" : "#EF4444" }]}>{badge.text}</Text>
            </View>
          )}
        </View>

        {/* Hero Value */}
        {heroValue && (
          <View style={styles.heroWrap}>
            <Text style={styles.heroValue}>{heroValue}</Text>
            {heroSuffix && <Text style={styles.heroSuffix}>{heroSuffix}</Text>}
          </View>
        )}

        {/* Content */}
        {children && <View style={styles.cardContent}>{children}</View>}

        {/* Actions */}
        {actions && actions.length > 0 && (
          <View style={styles.actionsRow}>
            {actions.map((action, idx) => (
              <Pressable
                key={idx}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.actionBtn,
                  action.primary && { backgroundColor: config.accentColor },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                ]}
              >
                <Text style={[styles.actionBtnText, action.primary && { color: "#FFFFFF" }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

/** 列表行组件 */
export function CardListRow({ 
  title, 
  subtitle, 
  value, 
  valueColor,
  valueSub,
  rank,
}: { 
  title: string; 
  subtitle?: string; 
  value: string; 
  valueColor?: string;
  valueSub?: string;
  rank?: number;
}) {
  return (
    <View style={styles.listRow}>
      {rank !== undefined && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{rank}</Text>
        </View>
      )}
      <View style={styles.listLeft}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle && <Text style={styles.listSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.listRight}>
        <Text style={[styles.listValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
        {valueSub && <Text style={styles.listValueSub}>{valueSub}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 24,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    marginVertical: 4,
  },
  cardGradient: {
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ManusColors.text,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: ManusColors.muted,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  heroWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: "800",
    color: ManusColors.text,
    letterSpacing: -1,
  },
  heroSuffix: {
    fontSize: 16,
    fontWeight: "600",
    color: ManusColors.muted,
  },
  cardContent: {
    gap: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: ManusColors.text,
  },
  // List Row
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
    gap: 10,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 12,
    fontWeight: "700",
    color: ManusColors.muted,
  },
  listLeft: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: ManusColors.text,
  },
  listSubtitle: {
    fontSize: 12,
    color: ManusColors.muted,
  },
  listRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  listValue: {
    fontSize: 15,
    fontWeight: "700",
    color: ManusColors.text,
  },
  listValueSub: {
    fontSize: 11,
    color: ManusColors.muted,
  },
});

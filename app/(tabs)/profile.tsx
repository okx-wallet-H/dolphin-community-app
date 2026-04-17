import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  ManusColors,
  ManusRadius,
  ManusShadow,
  ManusSpacing,
} from "@/constants/manus-ui";

const sections = [
  {
    id: "1",
    title: "安全中心",
    subtitle: "管理设备验证、交易确认和风险提醒",
    icon: "shield.fill" as const,
  },
  {
    id: "2",
    title: "通知设置",
    subtitle: "配置价格提醒、任务结果和资产异动通知",
    icon: "bell.fill" as const,
  },
  {
    id: "3",
    title: "偏好设置",
    subtitle: "调整法币展示、语言与界面偏好",
    icon: "gearshape.fill" as const,
  },
  {
    id: "4",
    title: "钱包管理",
    subtitle: "查看地址、导出记录与多钱包切换",
    icon: "wallet.pass.fill" as const,
  },
];

export default function ProfileScreen() {
  return (
    <ScreenContainer
      className="px-4 pt-4"
      safeAreaClassName="bg-background"
      containerClassName="bg-background"
    >
      <FlatList
        data={sections}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.pageTitle}>我的</Text>
              <Text style={styles.pageSubtitle}>统一管理账户安全、通知提醒、界面偏好与钱包资料，延续整套产品的高端金融感与可信赖表达。</Text>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.profileMainRow}>
                <View style={styles.avatarOuter}>
                  <View style={styles.avatarInner}>
                    <Text style={styles.avatarText}>海</Text>
                  </View>
                </View>

                <View style={styles.profileInfoWrap}>
                  <Text style={styles.profileName}>海豚社区用户</Text>
                  <Text style={styles.profileAddress}>0xA8F2...9C31</Text>
                  <View style={styles.securityPill}>
                    <Text style={styles.securityPillText}>账户安全等级：高</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>3 个</Text>
                <Text style={styles.statLabel}>钱包总数</Text>
                <Text style={styles.statHint}>已完成主链与多地址管理</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>12 条</Text>
                <Text style={styles.statLabel}>已启用提醒</Text>
                <Text style={styles.statHint}>价格、任务、资产异动均已覆盖</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.listCard, pressed && styles.listCardPressed]}
          >
            <View style={styles.listIconWrap}>
              <IconSymbol name={item.icon} size={21} color={ManusColors.primary} />
            </View>
            <View style={styles.listTextWrap}>
              <Text style={styles.listTitle}>{item.title}</Text>
              <Text style={styles.listSubtitle}>{item.subtitle}</Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color="rgba(71,84,103,0.72)" />
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 140,
    gap: ManusSpacing.lg,
    backgroundColor: ManusColors.background,
  },
  headerStack: {
    marginBottom: ManusSpacing.md,
    gap: ManusSpacing.lg,
  },
  headerTextWrap: {
    gap: ManusSpacing.sm,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: ManusColors.text,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: ManusColors.muted,
  },
  profileCard: {
    borderRadius: 28,
    padding: ManusSpacing.xl,
    backgroundColor: ManusColors.surface,
    borderWidth: 1,
    borderColor: "rgba(110,91,255,0.10)",
    ...ManusShadow,
  },
  profileMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ManusSpacing.lg,
  },
  avatarOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(110,91,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(110,91,255,0.16)",
  },
  avatarInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    color: ManusColors.primary,
  },
  profileInfoWrap: {
    flex: 1,
    gap: 6,
  },
  profileName: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    color: ManusColors.text,
  },
  profileAddress: {
    fontSize: 14,
    lineHeight: 20,
    color: ManusColors.muted,
  },
  securityPill: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: ManusRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(110,91,255,0.10)",
  },
  securityPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: ManusColors.primary,
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 24,
    padding: ManusSpacing.card,
    backgroundColor: ManusColors.surface,
    borderWidth: 1,
    borderColor: ManusColors.divider,
    gap: 4,
    ...ManusShadow,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: ManusColors.primary,
  },
  statLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: ManusColors.text,
  },
  statHint: {
    fontSize: 12,
    lineHeight: 18,
    color: ManusColors.muted,
  },
  listCard: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: ManusColors.surface,
    borderWidth: 1,
    borderColor: ManusColors.divider,
    gap: 14,
    ...ManusShadow,
  },
  listCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  listIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(110,91,255,0.10)",
  },
  listTextWrap: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: ManusColors.text,
  },
  listSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: ManusColors.muted,
  },
});

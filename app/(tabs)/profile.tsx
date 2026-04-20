import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ManusColors } from "@/constants/manus-ui";

type SettingItem = { id: string; title: string; sub: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"] };

const settingsGroup1: SettingItem[] = [
  { id: "security", title: "账户与安全", sub: "密码、生物识别、多因素认证", icon: "shield-check-outline" },
  { id: "wallet", title: "钱包管理", sub: "备份、导入、多链管理", icon: "wallet-outline" },
];

const settingsGroup2: SettingItem[] = [
  { id: "notification", title: "通知设置", sub: "交易提醒、安全警告", icon: "bell-outline" },
  { id: "ai", title: "AI 偏好", sub: "模型选择、对话风格", icon: "robot-outline" },
  { id: "community", title: "社区偏好", sub: "隐私设置、互动权限", icon: "account-group-outline" },
];

const settingsGroup3: SettingItem[] = [
  { id: "privacy", title: "隐私与权限", sub: "数据管理、应用授权", icon: "lock-outline" },
  { id: "help", title: "帮助中心", sub: "常见问题、在线客服", icon: "help-circle-outline" },
];

function SettingRow({ item, isLast }: { item: SettingItem; isLast: boolean }) {
  return (
    <Pressable style={({ pressed }) => [s.settingRow, !isLast && s.settingBorder, pressed && { opacity: 0.7 }]}>
      <View style={s.settingIcon}>
        <MaterialCommunityIcons name={item.icon} size={20} color="#06B6D4" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.settingTitle}>{item.title}</Text>
        <Text style={s.settingSub}>{item.sub}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.4)" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#0F172A", "#1E293B", "#0F172A"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable hitSlop={8} onPress={() => router.push("/(tabs)/chat")} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.5 }]}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color="#FFFFFF" />
          </Pressable>
          <Text style={s.headerTitle}>我的</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Profile card */}
          <View style={s.profileCard}>
            <View style={s.profileTop}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>C</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.profileName}>CryptoExplorer</Text>
                <Text style={s.profileEmail}>crypto@hwallet.com</Text>
              </View>
            </View>

            <View style={s.memberRow}>
              <View>
                <Text style={s.memberTitle}>Pro Member</Text>
                <Text style={s.memberExpiry}>到期时间: 2025.12.31</Text>
              </View>
              <Pressable style={s.memberBtn}>
                <Text style={s.memberBtnText}>专属权益</Text>
                <MaterialIcons name="chevron-right" size={16} color="#06B6D4" />
              </Pressable>
            </View>

            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statValue}>126</Text>
                <Text style={s.statLabel}>本月对话次数</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>8</Text>
                <Text style={s.statLabel}>自动任务数</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>3</Text>
                <Text style={s.statLabel}>已连接钱包数</Text>
              </View>
            </View>
          </View>

          {/* Settings Group 1 */}
          <View style={s.settingsCard}>
            {settingsGroup1.map((item, i) => (
              <SettingRow key={item.id} item={item} isLast={i === settingsGroup1.length - 1} />
            ))}
          </View>

          {/* Settings Group 2 */}
          <View style={s.settingsCard}>
            {settingsGroup2.map((item, i) => (
              <SettingRow key={item.id} item={item} isLast={i === settingsGroup2.length - 1} />
            ))}
          </View>

          {/* Settings Group 3 */}
          <View style={s.settingsCard}>
            {settingsGroup3.map((item, i) => (
              <SettingRow key={item.id} item={item} isLast={i === settingsGroup3.length - 1} />
            ))}
          </View>

          {/* Logout */}
          <Pressable style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.8 }]}>
            <Text style={s.logoutText}>退出登录</Text>
          </Pressable>

          {/* Version */}
          <Text style={s.version}>版本 v2.1.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  /* Profile card */
  profileCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.2)",
  },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(6,182,212,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#06B6D4" },
  profileName: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  profileEmail: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  memberTitle: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  memberExpiry: { fontSize: 12, color: "#06B6D4", marginTop: 2 },
  memberBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  memberBtnText: { fontSize: 13, fontWeight: "600", color: "#06B6D4" },

  statsRow: { flexDirection: "row", alignItems: "center", paddingTop: 12 },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.1)" },

  /* Settings card */
  settingsCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.1)",
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  settingBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(6,182,212,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  settingTitle: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  settingSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 },

  /* Logout */
  logoutBtn: {
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#06B6D4",
    marginTop: 8,
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: "#06B6D4" },

  version: { textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 16 },
});

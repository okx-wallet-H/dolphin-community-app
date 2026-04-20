import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { clearUserInfo, getUserInfo, removeSessionToken } from "@/lib/_core/auth";

// Design colors matching the overall theme
const COLORS = {
  bgStart: "#FFFFFF",
  bgMid: "#F8F5FF",
  bgEnd: "#F0EBFF",
  primary: "#7C3AED",
  primaryLight: "#A78BFA",
  text: "#1F1F3D",
  textSecondary: "#6B6B8D",
  white: "#FFFFFF",
  cardBg: "rgba(255,255,255,0.92)",
  danger: "#EF4444",
};

type SettingItem = {
  id: string;
  title: string;
  sub: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
};

const settingsGroup1: SettingItem[] = [
  { id: "security", title: "账户与安全", sub: "密码、生物识别、多因素认证", icon: "shield-check-outline", color: COLORS.primary },
  { id: "wallet", title: "钱包管理", sub: "备份、导入、多链管理", icon: "wallet-outline", color: "#F59E0B" },
];

const settingsGroup2: SettingItem[] = [
  { id: "notification", title: "通知设置", sub: "交易提醒、安全警告", icon: "bell-outline", color: "#10B981" },
  { id: "ai", title: "AI 偏好", sub: "模型选择、对话风格", icon: "robot-outline", color: "#06B6D4" },
];

const settingsGroup3: SettingItem[] = [
  { id: "help", title: "帮助中心", sub: "常见问题、在线客服", icon: "help-circle-outline", color: "#6366F1" },
  { id: "about", title: "关于我们", sub: "版本信息、用户协议", icon: "information-outline", color: "#8B5CF6" },
];

function SettingRow({ item, isLast }: { item: SettingItem; isLast: boolean }) {
  return (
    <Pressable style={({ pressed }) => [s.settingRow, !isLast && s.settingBorder, pressed && { opacity: 0.7 }]}>
      <View style={[s.settingIcon, { backgroundColor: `${item.color}15` }]}>
        <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
      </View>
      <View style={s.settingContent}>
        <Text style={s.settingTitle}>{item.title}</Text>
        <Text style={s.settingSub}>{item.sub}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    getUserInfo().then((info) => {
      if (info?.email) setUserEmail(info.email);
    });
  }, []);

  const handleLogout = useCallback(async () => {
    await removeSessionToken();
    await clearUserInfo();
    await AsyncStorage.removeItem("hwallet-agent-wallet");
    router.replace("/");
  }, [router]);

  return (
    <View style={s.root}>
      <LinearGradient colors={[COLORS.bgStart, COLORS.bgMid, COLORS.bgEnd]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable hitSlop={8} onPress={() => router.back()} style={s.backBtn}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color={COLORS.text} />
          </Pressable>
          <Text style={s.headerTitle}>我的</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <View style={s.profileCard}>
            <View style={s.profileTop}>
              <View style={s.avatar}>
                <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.avatarImg} />
              </View>
              <View style={s.profileInfo}>
                <Text style={s.profileName}>H Wallet 用户</Text>
                <Text style={s.profileEmail}>{userEmail || "未登录"}</Text>
              </View>
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statValue}>126</Text>
                <Text style={s.statLabel}>对话次数</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>8</Text>
                <Text style={s.statLabel}>自动任务</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>3</Text>
                <Text style={s.statLabel}>已连钱包</Text>
              </View>
            </View>
          </View>

          {/* Settings Groups */}
          <View style={s.settingsCard}>
            {settingsGroup1.map((item, i) => (
              <SettingRow key={item.id} item={item} isLast={i === settingsGroup1.length - 1} />
            ))}
          </View>

          <View style={s.settingsCard}>
            {settingsGroup2.map((item, i) => (
              <SettingRow key={item.id} item={item} isLast={i === settingsGroup2.length - 1} />
            ))}
          </View>

          <View style={s.settingsCard}>
            {settingsGroup3.map((item, i) => (
              <SettingRow key={item.id} item={item} isLast={i === settingsGroup3.length - 1} />
            ))}
          </View>

          {/* Logout Button */}
          <Pressable style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.8 }]} onPress={handleLogout}>
            <LinearGradient colors={["#FEE2E2", "#FECACA"]} style={s.logoutGradient}>
              <MaterialCommunityIcons name="logout" size={18} color={COLORS.danger} />
              <Text style={s.logoutText}>退出登录</Text>
            </LinearGradient>
          </Pressable>

          {/* Version */}
          <Text style={s.version}>H Wallet v2.1.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  // Header
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },

  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },

  // Profile Card
  profileCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.08)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(124,58,237,0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 64, height: 64 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  profileEmail: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },

  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700", color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: "rgba(0,0,0,0.06)" },

  // Settings Card
  settingsCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.06)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  settingSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Logout
  logoutBtn: { borderRadius: 16, overflow: "hidden", marginTop: 8 },
  logoutGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: COLORS.danger },

  // Version
  version: { textAlign: "center", fontSize: 12, color: COLORS.textSecondary, marginTop: 20 },
});

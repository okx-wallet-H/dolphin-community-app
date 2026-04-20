import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ManusColors } from "@/constants/manus-ui";

const settings = [
  { id: "1", title: "安全中心", sub: "设备验证、交易确认和风险提醒", icon: "shield" as const },
  { id: "2", title: "通知设置", sub: "价格提醒、任务结果和资产异动", icon: "notifications-none" as const },
  { id: "3", title: "偏好设置", sub: "法币展示、语言与界面偏好", icon: "tune" as const },
  { id: "4", title: "钱包管理", sub: "地址查看、导出记录与多钱包切换", icon: "account-balance-wallet" as const },
];

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable hitSlop={8} onPress={() => router.push("/(tabs)/chat")} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.5 }]}>
          <MaterialIcons name="arrow-back-ios-new" size={18} color={ManusColors.text} />
        </Pressable>
        <Text style={s.headerTitle}>设置</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>D</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>Dolphin 用户</Text>
            <Text style={s.profileAddr}>0xA8F2...9C31</Text>
          </View>
          <View style={s.secBadge}>
            <Text style={s.secBadgeText}>安全</Text>
          </View>
        </View>

        {/* Settings list */}
        {settings.map((item) => (
          <Pressable key={item.id} style={({ pressed }) => [s.settingRow, pressed && { backgroundColor: "#F9FAFB" }]}>
            <View style={s.settingIcon}>
              <MaterialIcons name={item.icon} size={20} color={ManusColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.settingTitle}>{item.title}</Text>
              <Text style={s.settingSub}>{item.sub}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={ManusColors.muted} />
          </Pressable>
        ))}

        {/* Version */}
        <Text style={s.version}>Dolphin v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: ManusColors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },

  profileCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: ManusColors.surfaceTint, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: ManusColors.primary },
  profileName: { fontSize: 17, fontWeight: "700", color: ManusColors.text },
  profileAddr: { fontSize: 13, color: ManusColors.muted, marginTop: 2 },
  secBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#ECFDF5" },
  secBadgeText: { fontSize: 11, fontWeight: "700", color: "#10B981" },

  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" },
  settingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: ManusColors.surfaceTint, alignItems: "center", justifyContent: "center" },
  settingTitle: { fontSize: 15, fontWeight: "600", color: ManusColors.text },
  settingSub: { fontSize: 12, color: ManusColors.muted, marginTop: 1 },

  version: { textAlign: "center", fontSize: 12, color: ManusColors.muted, marginTop: 40 },
});

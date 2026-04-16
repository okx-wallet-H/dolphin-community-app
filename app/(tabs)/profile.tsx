import { FlatList, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";

const sections = [
  { id: "1", title: "安全中心", subtitle: "管理设备验证、交易确认和风险提醒", icon: "shield.fill" as const },
  { id: "2", title: "通知设置", subtitle: "配置价格提醒、任务结果和资产异动通知", icon: "bell.fill" as const },
  { id: "3", title: "偏好设置", subtitle: "调整法币展示、语言与界面偏好", icon: "gearshape.fill" as const },
  { id: "4", title: "钱包管理", subtitle: "查看地址、导出记录与多钱包切换", icon: "wallet.pass.fill" as const },
];

export default function ProfileScreen() {
  return (
    <ScreenContainer className="px-5 pt-4" safeAreaClassName="bg-background">
      <FlatList
        data={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListHeaderComponent={
          <View className="mb-6 gap-4">
            <LinearGradient
              colors={["rgba(124,58,237,0.28)", "rgba(34,211,238,0.18)", "rgba(255,255,255,0.06)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="rounded-[30px] border border-white/10"
            >
              <View className="items-center bg-white/10 px-5 py-6">
                <View className="h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/10">
                  <Text className="text-2xl font-bold text-foreground">HW</Text>
                </View>
                <Text className="mt-4 text-2xl font-bold text-foreground">H Wallet 用户</Text>
                <Text className="mt-2 text-sm text-muted">0xA8F2...9C31</Text>
                <View className="mt-4 rounded-full border border-success/30 bg-success/15 px-4 py-2">
                  <Text className="text-xs font-semibold text-success">账户安全等级：高</Text>
                </View>
              </View>
            </LinearGradient>

            <View className="flex-row gap-3">
              <View className="flex-1 rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                <Text className="text-xs text-muted">钱包总数</Text>
                <Text className="mt-2 text-lg font-semibold text-foreground">3 个</Text>
              </View>
              <View className="flex-1 rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                <Text className="text-xs text-muted">已启用提醒</Text>
                <Text className="mt-2 text-lg font-semibold text-foreground">12 条</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
          >
            <View className="mb-3 flex-row items-center rounded-[24px] border border-white/10 bg-white/8 px-4 py-4">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <IconSymbol name={item.icon} size={22} color="#F8FAFC" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-base font-semibold text-foreground">{item.title}</Text>
                <Text className="mt-1 text-xs leading-5 text-muted">{item.subtitle}</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="rgba(248,250,252,0.7)" />
            </View>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  primary: "#7C3AED",
  tabBg: "rgba(255,255,255,0.98)",
  textMuted: "#9CA3AF",
  bgSoft: "#FCFAFF",
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === "web" ? 14 : Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: COLORS.bgSoft },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 60 + safeBottom,
          paddingBottom: safeBottom,
          backgroundColor: COLORS.tabBg,
          borderTopWidth: 1,
          borderTopColor: "rgba(124,58,237,0.06)",
          shadowColor: "#7C3AED",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "钱包",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActive : undefined}>
              <MaterialCommunityIcons name="wallet-outline" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          href: null,
          title: "行情",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="chart-line" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "对话",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActive : undefined}>
              <MaterialCommunityIcons name="swap-horizontal" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="earn"
        options={{
          href: null,
          title: "赚币",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="gift-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "我的",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActive : undefined}>
              <MaterialCommunityIcons name="account-outline" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconActive: {
    backgroundColor: "rgba(124,58,237,0.08)",
    borderRadius: 12,
    padding: 4,
  },
});

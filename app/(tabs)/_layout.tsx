import { Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";

const PRIMARY = "#7C3AED";
const PRIMARY_SOFT = "#FCFAFF";
const TEXT_MUTED = "#7B8199";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === "web" ? 14 : Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: PRIMARY_SOFT },
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: TEXT_MUTED,
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: safeBottom,
          height: 82,
          paddingTop: 10,
          paddingBottom: 10,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
        },
        tabBarItemStyle: {
          borderRadius: 24,
          marginHorizontal: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 2,
        },
        tabBarBackground: () => (
          <View style={styles.tabBarWrap}>
            <View style={styles.tabBarShadow} />
            <LinearGradient
              colors={[
                "rgba(255,255,255,0.72)",
                "rgba(169,120,255,0.28)",
                "rgba(124,58,237,0.14)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabBarBorder}
            >
              <View style={styles.tabBarShell}>
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0.98)",
                    "rgba(248,244,255,0.94)",
                    "rgba(244,239,255,0.90)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            </LinearGradient>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "钱包",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: "行情",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.line.uptrend.xyaxis" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "对话",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="message.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="earn"
        options={{
          title: "赚币",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "我的",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.crop.circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  tabBarShadow: {
    position: "absolute",
    top: 12,
    left: 24,
    right: 24,
    bottom: -6,
    borderRadius: 30,
    backgroundColor: "rgba(124,58,237,0.12)",
    shadowColor: PRIMARY,
    shadowOpacity: Platform.OS === "ios" ? 0.22 : 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  tabBarBorder: {
    flex: 1,
    borderRadius: 30,
    padding: 1,
    overflow: "hidden",
  },
  tabBarShell: {
    flex: 1,
    borderRadius: 29,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.12)",
    backgroundColor: PRIMARY_SOFT,
  },
});

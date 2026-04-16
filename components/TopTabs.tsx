import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import {
  ManusColors,
  ManusRadius,
  ManusShadow,
  ManusSpacing,
  ManusTypography,
} from "@/constants/manus-ui";

type Props = {
  activeTab: "chat" | "community";
  onChange: (tab: "chat" | "community") => void;
};

const tabs = [
  { key: "chat", label: "对话" },
  { key: "community", label: "社区" },
] as const;

export function TopTabs({ activeTab, onChange }: Props) {
  return (
    <View style={styles.outer}>
      <View style={styles.wrapper}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={({ pressed }) => [
                styles.tab,
                active && styles.activeTab,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.label, active ? styles.activeLabel : styles.inactiveLabel]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    maxWidth: 232,
    padding: 4,
    borderRadius: ManusRadius.pill,
    backgroundColor: Colors.light.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ManusRadius.pill,
  },
  activeTab: {
    backgroundColor: Colors.light.canvas,
    ...ManusShadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  label: {
    ...ManusTypography.tab,
  },
  activeLabel: {
    color: ManusColors.text,
  },
  inactiveLabel: {
    color: ManusColors.muted,
  },
  pressed: {
    opacity: 0.86,
  },
});

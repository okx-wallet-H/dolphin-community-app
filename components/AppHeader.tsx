import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { ManusColors } from "@/constants/manus-ui";

type Props = {
  title?: string;
  centerContent?: React.ReactNode;
  onWalletPress?: () => void;
  onRightPress?: () => void;
  leftIcon?: keyof typeof MaterialIcons.glyphMap;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  containerStyle?: ViewStyle;
};

export function AppHeader({
  title,
  centerContent,
  onWalletPress,
  onRightPress,
  leftIcon = "account-balance-wallet",
  rightIcon = "person-outline",
  containerStyle,
}: Props) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Pressable
        onPress={onWalletPress}
        hitSlop={8}
        style={({ pressed }) => [styles.iconHit, pressed && styles.pressed]}
      >
        <MaterialIcons name={leftIcon} size={22} color={ManusColors.text} />
      </Pressable>

      <View style={styles.centerWrap}>
        {centerContent ?? <Text style={styles.title}>{title}</Text>}
      </View>

      <Pressable
        onPress={onRightPress}
        hitSlop={8}
        style={({ pressed }) => [styles.iconHit, pressed && styles.pressed]}
      >
        <MaterialIcons name={rightIcon} size={22} color={ManusColors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconHit: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: ManusColors.text,
    letterSpacing: -0.3,
  },
  pressed: {
    opacity: 0.5,
  },
});

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { Colors } from "@/constants/theme";
import {
  ManusColors,
  ManusEmphasisShadow,
  ManusRadius,
  ManusShadow,
  ManusSpacing,
  ManusTypography,
} from "@/constants/manus-ui";

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
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <MaterialIcons name={leftIcon} size={20} color={Colors.light.foreground} />
      </Pressable>

      <View style={styles.centerWrap}>
        {centerContent ?? <Text style={styles.title}>{title}</Text>}
      </View>

      <Pressable
        onPress={onRightPress}
        style={({ pressed }) => [styles.iconButton, styles.rightButton, pressed && styles.pressed]}
      >
        <MaterialIcons name={rightIcon} size={20} color={Colors.light.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ManusSpacing.md,
    paddingHorizontal: ManusSpacing.page,
    paddingTop: ManusSpacing.sm,
    paddingBottom: ManusSpacing.md,
    backgroundColor: "transparent",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: ManusRadius.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.glass,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...ManusShadow,
  },
  rightButton: {
    ...ManusEmphasisShadow,
    shadowOpacity: 0.08,
  },
  title: {
    ...ManusTypography.sectionTitle,
    color: ManusColors.text,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});

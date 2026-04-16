import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts } from '../constants/theme';
import { ManusSpacing, ManusTypography } from '../constants/manus-ui';

type Props = {
  title: string;
  onWalletPress?: () => void;
  onRightPress?: () => void;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
};

export function AppHeader({
  title,
  onWalletPress,
  onRightPress,
  rightIcon = 'notifications-none',
}: Props) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onWalletPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <MaterialIcons name="account-balance-wallet" size={21} color={Colors.light.text} />
      </Pressable>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Pressable onPress={onRightPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <MaterialIcons name={rightIcon} size={21} color={Colors.light.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ManusSpacing.md,
    paddingTop: ManusSpacing.xs,
    paddingBottom: ManusSpacing.sm,
    backgroundColor: Colors.light.background,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  title: {
    ...ManusTypography.pageTitle,
    color: Colors.light.text,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
});

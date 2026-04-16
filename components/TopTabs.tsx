import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '../constants/theme';
import { ManusSpacing, ManusTypography } from '../constants/manus-ui';

type Props = {
  activeTab: 'chat' | 'community';
  onChange: (tab: 'chat' | 'community') => void;
};

const tabs = [
  { key: 'chat', label: '对话' },
  { key: 'community', label: '社区' },
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
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Text style={[styles.label, active ? styles.activeLabel : styles.inactiveLabel]}>{tab.label}</Text>
              <View style={[styles.underline, active && styles.activeUnderline]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: ManusSpacing.md,
    paddingTop: ManusSpacing.sm,
    paddingBottom: ManusSpacing.sm,
    backgroundColor: Colors.light.background,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 260,
    backgroundColor: Colors.light.background,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  label: {
    ...ManusTypography.body,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  activeLabel: {
    color: '#7038DC',
  },
  inactiveLabel: {
    color: '#999999',
  },
  underline: {
    marginTop: 8,
    width: 28,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  activeUnderline: {
    backgroundColor: '#7038DC',
  },
  pressed: {
    opacity: 0.82,
  },
});

import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearUserInfo, removeSessionToken } from '@/lib/_core/auth';
import { logout } from '@/lib/_core/api';

const PRIMARY = '#7C3AED';
const TEXT_PRIMARY = '#1A1A2E';
const TEXT_BODY = '#31324A';
const TEXT_SECONDARY = '#666C85';
const BORDER = '#E8EAF2';

const SETTING_ITEMS = [
  { key: 'security', icon: 'lock-outline', label: '账户安全', value: '' },
  { key: 'notice', icon: 'notifications-none', label: '通知设置', value: '' },
  { key: 'language', icon: 'language', label: '语言', value: '中文' },
  { key: 'about', icon: 'info-outline', label: '关于我们', value: '' },
] as const;

const STATS = [
  { key: 'session', value: '已连接', label: '会话状态', accent: PRIMARY },
  { key: 'wallet', value: '双链路', label: '钱包地址簇', accent: TEXT_PRIMARY },
  { key: 'strategy', value: '已启用', label: '策略中心', accent: TEXT_PRIMARY },
] as const;

function BottomNavBar() {
  return (
    <View style={styles.bottomNavCard}>
      <Pressable style={styles.bottomNavItem} onPress={() => router.replace('/(tabs)/wallet')}>
        <MaterialCommunityIcons name="home-outline" size={22} color="#8F96A8" />
      </Pressable>
      <Pressable style={styles.bottomNavItem} onPress={() => router.replace('/(tabs)/wallet')}>
        <MaterialCommunityIcons name="wallet-outline" size={22} color="#8F96A8" />
      </Pressable>
      <Pressable style={styles.bottomNavItem} onPress={() => router.replace('/(tabs)/community')}>
        <MaterialCommunityIcons name="account-group-outline" size={22} color="#8F96A8" />
      </Pressable>
      <Pressable style={styles.bottomNavItem} onPress={() => router.replace('/(tabs)/chat')}>
        <MaterialCommunityIcons name="chat-processing-outline" size={22} color="#8F96A8" />
      </Pressable>
      <View style={styles.bottomNavItem}>
        <MaterialCommunityIcons name="account" size={22} color={PRIMARY} />
      </View>
    </View>
  );
}

export default function SettingsRoute() {
  const insets = useSafeAreaInsets();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await Promise.allSettled([clearUserInfo(), removeSessionToken(), logout()]);
      router.replace('/');
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topGlow} />
      <View style={styles.leftGlow} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 150 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.headerAction} onPress={() => router.replace('/(tabs)/wallet')}>
            <MaterialCommunityIcons name="wallet-outline" size={22} color={TEXT_PRIMARY} />
            <Text style={styles.headerActionText}>钱包入口</Text>
          </Pressable>
          <Text style={styles.headerTitle}>设置</Text>
          <Pressable style={styles.headerAction}>
            <MaterialCommunityIcons name="email-outline" size={22} color={TEXT_PRIMARY} />
          </Pressable>
        </View>

        <View style={styles.profileSection}>
          <LinearGradient colors={['#B58CFF', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarLetter}>H</Text>
            </View>
          </LinearGradient>
          <Text style={styles.profileName}>H Wallet 账号</Text>
          <Text style={styles.profileEmail}>当前登录邮箱将在会话恢复后展示</Text>
          <LinearGradient colors={['#EBD18A', '#C19A45', '#EFD9A5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>已启用安全会话</Text>
          </LinearGradient>
        </View>

        <View style={styles.statsCard}>
          {STATS.map((item, index) => (
            <View key={item.key} style={[styles.statItem, index !== STATS.length - 1 && styles.statDivider]}>
              <Text style={[styles.statValue, { color: item.accent }]}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.settingListCard}>
          {SETTING_ITEMS.map((item, index) => (
            <Pressable key={item.key} style={[styles.settingRow, index !== SETTING_ITEMS.length - 1 && styles.settingRowBorder]}>
              <View style={styles.settingLeft}>
                <MaterialIcons name={item.icon as 'lock-outline' | 'notifications-none' | 'language' | 'info-outline'} size={22} color={PRIMARY} />
                <Text style={styles.settingLabel}>{item.label}</Text>
              </View>
              <View style={styles.settingRight}>
                {item.value ? <Text style={styles.settingValue}>{item.value}</Text> : null}
                <MaterialIcons name="chevron-right" size={22} color="#B8BDCC" />
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient colors={['#FF7B7B', '#FF4D5E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoutButtonGradient}>
            {isLoggingOut ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.logoutButtonText}>退出登录</Text>}
          </LinearGradient>
        </Pressable>
      </ScrollView>

      <View style={[styles.bottomNavWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}> 
        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  topGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(124,58,237,0.10)',
  },
  leftGlow: {
    position: 'absolute',
    top: 120,
    left: -90,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(180,148,255,0.10)',
  },
  headerRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerAction: {
    width: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerActionText: {
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_BODY,
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 4,
  },
  avatarInner: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 52,
    lineHeight: 60,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileName: {
    marginTop: 18,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  profileEmail: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 22,
    color: TEXT_SECONDARY,
  },
  memberBadge: {
    marginTop: 14,
    minWidth: 110,
    height: 34,
    paddingHorizontal: 18,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C19A45',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  memberBadgeText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#6A4B17',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 18,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    borderRightWidth: 1,
    borderRightColor: '#F2F3F7',
  },
  statValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },
  settingListCard: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  settingRow: {
    minHeight: 64,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F2F3F7',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingValue: {
    fontSize: 16,
    lineHeight: 24,
    color: TEXT_SECONDARY,
  },
  logoutButton: {
    marginTop: 22,
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
  },
  logoutButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  logoutButtonText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  bottomNavCard: {
    height: 66,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#EFEAF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  bottomNavItem: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

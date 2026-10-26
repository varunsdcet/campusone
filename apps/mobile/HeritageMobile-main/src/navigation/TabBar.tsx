import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, IconName, Text } from '../components';
import { colors, spacing } from '../theme';

export function createTabBar(defs: readonly { route: string; label: string; icon: IconName }[], badges?: () => Record<string, boolean>) {
  return function TabBar({ state, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const badgeMap = badges?.() ?? {};
    return (
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist" testID="tab-bar">
        {state.routes.map((route, index) => {
          const def = defs.find(d => d.route === route.name)!;
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              testID={`tab-${def.label.toLowerCase()}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={def.label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.tab}
            >
              <View>
                <Icon name={def.icon} size={22} color={focused ? colors.green900 : colors.inkMuted} strokeWidth={focused ? 2.4 : 2} />
                {badgeMap[route.name] ? <View style={styles.badge} /> : null}
              </View>
              <Text variant="caption" color={focused ? colors.green900 : colors.inkMuted} style={{ fontFamily: focused ? 'Inter-SemiBold' : 'Inter-Regular', fontSize: 11 }}>{def.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  };
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, paddingHorizontal: spacing.sm },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 48 },
  badge: { position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral500 },
});

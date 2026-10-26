import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { colors, spacing, touchTarget } from '../theme';

export interface HeaderAction {
  icon?: IconName;
  label?: string;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: boolean;
  testID?: string;
  variant?: 'icon' | 'primary' | 'text';
}

export interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  overline?: string;
  backLabel?: string;
  onBack?: () => void;
  hideBack?: boolean;
  actions?: HeaderAction[];
  dark?: boolean;
  center?: boolean;
  leftSlot?: React.ReactNode;
  serif?: boolean;
}

export function ScreenHeader({ title, subtitle, overline, backLabel, onBack, hideBack, actions = [], dark, center, leftSlot, serif }: ScreenHeaderProps) {
  const navigation = useNavigation();
  const canBack = !hideBack && (onBack || navigation.canGoBack());
  const fg = dark ? colors.white : colors.green900;
  const backAccessibilityLabel = !backLabel || /^back(?:\s|$)/i.test(backLabel) ? 'Back' : `Back to ${backLabel}`;
  return (
    <View style={[styles.wrap, dark ? styles.dark : null]} accessibilityRole="header">
      <View style={styles.side}>
        {canBack ? (
          <Pressable testID="header-back" accessibilityRole="button" accessibilityLabel={backAccessibilityLabel} onPress={onBack ?? (() => navigation.goBack())} hitSlop={8} style={styles.back}>
            <Icon name="ChevronLeft" size={24} color={fg} />
            {backLabel ? <Text variant="titleSm" color={fg}>{backLabel}</Text> : null}
          </Pressable>
        ) : leftSlot}
      </View>
      {title && !backLabel ? (
        <View style={[styles.titleBox, center ? styles.center : null]}>
          {overline ? <Text variant="overline" color={dark ? colors.green100 : undefined}>{overline}</Text> : null}
          <Text variant={serif ? 'displayXs' : 'titleMd'} color={fg} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text variant="caption" color={dark ? colors.green100 : undefined} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      ) : <View style={styles.titleBox} />}
      <View style={[styles.side, styles.right]}>
        {actions.map((a, i) => (
          <Pressable
            key={i}
            testID={a.testID}
            accessibilityRole="button"
            accessibilityLabel={a.accessibilityLabel}
            onPress={a.onPress}
            hitSlop={6}
            style={[styles.action, a.variant === 'primary' ? styles.primaryAction : null]}
          >
            {a.icon ? <Icon name={a.icon} size={22} color={a.variant === 'primary' ? colors.white : fg} /> : null}
            {a.label ? <Text variant="label" color={a.variant === 'primary' ? colors.white : fg}>{a.label}</Text> : null}
            {a.badge ? <View style={styles.badge} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, minHeight: 52, backgroundColor: 'transparent' },
  dark: { backgroundColor: colors.green900 },
  side: { minWidth: touchTarget, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end', gap: 2 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget, paddingRight: spacing.sm },
  titleBox: { flex: 1, paddingHorizontal: spacing.xs },
  center: { alignItems: 'center' },
  action: { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: spacing.sm },
  primaryAction: { backgroundColor: colors.green900, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 40 },
  badge: { position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.coral500, borderWidth: 1.5, borderColor: colors.cream },
});

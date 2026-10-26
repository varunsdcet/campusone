import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

export type PillTone = 'green' | 'coral' | 'gold' | 'grey' | 'dark' | 'red' | 'blue' | 'purple' | 'teal' | 'outline' | 'yellow' | 'warning';

const tones: Record<PillTone, { bg: string; fg: string; border?: string; dot?: string }> = {
  green: { bg: colors.success100, fg: colors.success600, dot: colors.success600 },
  coral: { bg: colors.coral100, fg: colors.coral600, dot: colors.coral600 },
  gold: { bg: colors.gold100, fg: colors.gold600, dot: colors.gold600 },
  yellow: { bg: colors.gold100, fg: colors.warning600, dot: colors.warning600 },
  warning: { bg: colors.warning100, fg: colors.warning600, dot: colors.warning600 },
  grey: { bg: colors.surfaceMuted, fg: colors.inkSecondary, dot: colors.inkMuted },
  dark: { bg: colors.green900, fg: colors.white, dot: colors.white },
  red: { bg: colors.danger100, fg: colors.danger600, dot: colors.danger600 },
  blue: { bg: colors.info100, fg: colors.info600, dot: colors.info600 },
  purple: { bg: colors.purple100, fg: colors.purple600, dot: colors.purple600 },
  teal: { bg: colors.teal100, fg: colors.teal600, dot: colors.teal600 },
  outline: { bg: colors.surface, fg: colors.green900, border: colors.green700, dot: colors.green700 },
};

export function Pill({ label, tone = 'grey', dot, small, style, icon, testID }: { label: string; tone?: PillTone; dot?: boolean; small?: boolean; style?: StyleProp<ViewStyle>; icon?: React.ReactNode; testID?: string }) {
  const t = tones[tone];
  return (
    <View testID={testID} accessibilityLabel={label} style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border ?? t.bg }, small ? styles.small : null, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.dot }]} /> : null}
      {icon}
      <Text variant={small ? 'caption' : 'label'} color={t.fg} numberOfLines={1} style={small ? { fontSize: 11 } : null}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  small: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Row, Text } from '../../components';
import { colors, spacing } from '../../theme';

export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'One uppercase letter', test: p => /[A-Z]/.test(p) },
  { label: 'One number', test: p => /\d/.test(p) },
  { label: 'One symbol (recommended)', test: p => /[^A-Za-z0-9]/.test(p) },
];

export const passwordMeetsRules = (p: string) => PASSWORD_RULES.slice(0, 3).every(r => r.test(p));

const LEVELS = [
  { label: 'Too weak', color: colors.danger600 },
  { label: 'Weak', color: colors.danger600 },
  { label: 'Fair', color: colors.gold600 },
  { label: 'Good', color: colors.success600 },
  { label: 'Strong', color: colors.success600 },
];

export function PasswordStrength({ password }: { password: string }) {
  const score = PASSWORD_RULES.filter(r => r.test(password)).length + (password.length >= 12 ? 1 : 0);
  const level = LEVELS[Math.min(score, 4)];
  return (
    <View style={styles.wrap} testID="password-strength">
      <Row justify="space-between">
        <View style={styles.track}>
          {[0, 1, 2, 3].map(i => <View key={i} style={[styles.seg, { backgroundColor: password && i < Math.min(score, 4) ? level.color : colors.border }]} />)}
        </View>
        <Text variant="caption" color={password ? level.color : colors.inkMuted}>{password ? level.label : ' '}</Text>
      </Row>
      {PASSWORD_RULES.map(r => {
        const ok = r.test(password);
        return (
          <Row key={r.label} gap={6}>
            <Icon name={ok ? 'CircleCheck' : 'Circle'} size={14} color={ok ? colors.success600 : colors.inkMuted} />
            <Text variant="caption" color={ok ? colors.success600 : colors.inkMuted}>{r.label}</Text>
          </Row>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, marginTop: -spacing.xs },
  track: { flexDirection: 'row', gap: 4, flex: 1, marginRight: spacing.sm },
  seg: { flex: 1, height: 4, borderRadius: 2 },
});

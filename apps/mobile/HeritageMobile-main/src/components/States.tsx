import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { colors, spacing } from '../theme';
import { ServiceError, errorMessage } from '../services/errors';

/** Skeleton placeholders by default; pass a label for action-specific progress (e.g. confirming a payment). */
export function LoadingState({ label, testID = 'loading-state' }: { label?: string; testID?: string }) {
  if (!label) return <SkeletonList testID={testID} />;
  return (
    <View style={styles.center} testID={testID} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.green900} size="large" />
      <Text variant="bodySm">{label}</Text>
    </View>
  );
}

export function SkeletonList({ rows = 3, testID }: { rows?: number; testID?: string }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse, gap: spacing.md }} testID={testID} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.skCard}>
          <View style={[styles.skLine, { width: '45%', height: 12 }]} />
          <View style={[styles.skLine, { width: '85%' }]} />
          <View style={[styles.skLine, { width: '65%' }]} />
        </View>
      ))}
    </Animated.View>
  );
}

export function EmptyState({ title, message, icon = 'Inbox', action, testID = 'empty-state', contained = true }: { title: string; message?: string; icon?: IconName; action?: { label: string; onPress: () => void }; testID?: string; contained?: boolean }) {
  return (
    <View style={[styles.center, contained ? styles.emptyCard : null]} testID={testID}>
      <View style={[styles.iconCircle, styles.emptyIcon]}><Icon name={icon} size={26} color={colors.green700} /></View>
      <Text variant="titleSm" align="center">{title}</Text>
      {message ? <Text variant="bodySm" align="center">{message}</Text> : null}
      {action ? <Button title={action.label} variant="outline" fullWidth={false} onPress={action.onPress} size="sm" /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, testID = 'error-state' }: { error: unknown; onRetry?: () => void; testID?: string }) {
  const denied = ServiceError.is(error, 'PERMISSION_DENIED');
  const notConfigured = ServiceError.is(error, 'NOT_CONFIGURED');
  return (
    <View style={styles.center} testID={testID} accessibilityLiveRegion="polite">
      <View style={[styles.iconCircle, { backgroundColor: denied ? colors.warning100 : colors.danger100 }]}>
        <Icon name={denied ? 'ShieldAlert' : notConfigured ? 'Unplug' : 'TriangleAlert'} size={26} color={denied ? colors.warning600 : colors.danger600} />
      </View>
      <Text variant="titleSm" align="center">{denied ? 'Permission denied' : notConfigured ? 'API not configured' : 'Something went wrong'}</Text>
      <Text variant="bodySm" align="center">{errorMessage(error)}</Text>
      {onRetry && !denied && !notConfigured ? <Button title="Retry" variant="outline" fullWidth={false} onPress={onRetry} size="sm" testID={`${testID}-retry`} /> : null}
    </View>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <View style={styles.inline} accessibilityLiveRegion="polite">
      <Icon name="CircleAlert" size={16} color={colors.danger600} />
      <Text variant="bodySm" color={colors.danger600} style={{ flex: 1 }}>{errorMessage(error)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm, minHeight: 180 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyCard: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20 },
  emptyIcon: { backgroundColor: colors.green50, borderWidth: 1, borderColor: colors.green100 },
  skCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  skLine: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceMuted },
  inline: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.danger100, padding: spacing.md, borderRadius: 12 },
});

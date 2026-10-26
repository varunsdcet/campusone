import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '../state/uiStore';
import { Text } from './Text';
import { Icon } from './Icon';
import { colors, radius, spacing } from '../theme';

export function OfflineBanner() {
  const offline = useUiStore(s => s.offline);
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  if (!offline) return null;
  return (
    <Pressable
      onPress={() => void qc.refetchQueries({ type: 'active' })}
      accessibilityRole="alert"
      accessibilityHint="Tap to try again"
      testID="offline-banner"
      style={[styles.banner, { bottom: insets.bottom + 72 }]}
    >
      <Icon name="WifiOff" size={16} color={colors.white} />
      <Text variant="bodySm" color={colors.white} style={{ flex: 1 }}>You're offline. Showing the last loaded data.</Text>
      <Text variant="label" color={colors.white}>Retry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 90, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.ink, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
});

import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiStore } from '../state/uiStore';
import { Text } from './Text';
import { colors, radius, spacing } from '../theme';

export function Toasts() {
  const toasts = useUiStore(s => s.toasts);
  const dismiss = useUiStore(s => s.dismissToast);
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      {toasts.map(t => (
        <Pressable key={t.id} onPress={() => dismiss(t.id)} accessibilityRole="alert" testID={`toast-${t.tone}`} style={[styles.toast, t.tone === 'error' ? styles.error : t.tone === 'success' ? styles.success : null]}>
          <Text variant="bodySm" color={colors.white}>{t.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm, zIndex: 100 },
  toast: { backgroundColor: colors.green900, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  error: { backgroundColor: colors.danger600 },
  success: { backgroundColor: colors.success600 },
});

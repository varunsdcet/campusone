import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from '../theme';

export type ButtonVariant = 'primary' | 'coral' | 'outline' | 'ghost' | 'danger' | 'subtle' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shown as helper text under a disabled button to explain the prerequisite. */
  disabledReason?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const variantStyles: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.green900, fg: colors.white },
  coral: { bg: colors.coral500, fg: colors.white },
  outline: { bg: colors.surface, fg: colors.green900, border: colors.green900 },
  ghost: { bg: 'transparent', fg: colors.green900 },
  danger: { bg: colors.danger600, fg: colors.white },
  subtle: { bg: colors.surfaceMuted, fg: colors.green900 },
  gold: { bg: colors.gold500, fg: colors.green900 },
};

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, disabledReason, loading, icon, iconRight, fullWidth = true, style, testID, accessibilityLabel }: ButtonProps) {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  const height = size === 'sm' ? 36 : size === 'lg' ? 54 : touchTarget + 4;
  return (
    <View style={[fullWidth ? styles.full : null, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
        accessibilityHint={isDisabled && disabledReason ? disabledReason : undefined}
        onPress={onPress}
        disabled={isDisabled}
        hitSlop={size === 'sm' ? 6 : 0}
        style={({ pressed }) => [
          styles.base,
          { backgroundColor: isDisabled && variant !== 'ghost' ? (variant === 'outline' ? colors.surfaceMuted : colors.borderStrong) : v.bg, minHeight: height, borderColor: v.border ?? 'transparent', borderWidth: v.border ? 1.5 : 0, opacity: pressed ? 0.85 : 1 },
          size === 'sm' ? styles.sm : null,
        ]}
      >
        {loading ? <ActivityIndicator color={v.fg} /> : (
          <View style={styles.row}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text variant={size === 'sm' ? 'label' : 'titleSm'} color={isDisabled && variant === 'outline' ? colors.inkMuted : v.fg} numberOfLines={2} align="center">{title}</Text>
            {iconRight ? <View style={styles.icon}>{iconRight}</View> : null}
          </View>
        )}
      </Pressable>
      {isDisabled && disabledReason ? <Text variant="caption" align="center" style={styles.reason}>{disabledReason}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  sm: { paddingHorizontal: spacing.md, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  reason: { marginTop: spacing.xs },
});

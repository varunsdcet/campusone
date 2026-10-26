import React from 'react';
import { Pressable, StyleSheet, View, ViewProps, ViewStyle, StyleProp } from 'react-native';
import { colors, radius, spacing, shadows } from '../theme';

export interface CardProps extends ViewProps {
  tone?: 'surface' | 'dark' | 'muted' | 'green' | 'coral' | 'gold' | 'outline' | 'warning' | 'danger' | 'info';
  padding?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
}

const toneStyle: Record<NonNullable<CardProps['tone']>, ViewStyle> = {
  surface: { backgroundColor: colors.surface, borderColor: colors.border },
  dark: { backgroundColor: colors.green900, borderColor: colors.green900 },
  muted: { backgroundColor: colors.surfaceMuted, borderColor: colors.surfaceMuted },
  green: { backgroundColor: colors.green50, borderColor: colors.green100 },
  coral: { backgroundColor: colors.coral50, borderColor: colors.coral100 },
  gold: { backgroundColor: colors.gold50, borderColor: colors.gold100 },
  outline: { backgroundColor: colors.surface, borderColor: colors.green700 },
  warning: { backgroundColor: colors.warning100, borderColor: colors.warning100 },
  danger: { backgroundColor: colors.danger100, borderColor: colors.danger100 },
  info: { backgroundColor: colors.teal100, borderColor: colors.teal100 },
};

export function Card({ tone = 'surface', padding = spacing.lg, onPress, style, children, selected, ...rest }: CardProps) {
  const content = (
    <View {...rest} style={[styles.card, toneStyle[tone], { padding }, tone === 'surface' ? shadows.card : null, selected ? styles.selected : null, style]}>
      {children}
    </View>
  );
  if (onPress) {
    const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, flex: flat.flex, alignSelf: flat.alignSelf, width: flat.width })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1 },
  selected: { borderColor: colors.green900, borderWidth: 1.5 },
});

import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { typography, TypographyVariant, colors } from '../theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

const weightFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

export function Text({ variant = 'body', color, align, weight, style, children, ...rest }: TextProps) {
  const base = typography[variant];
  const isSerif = String(base.fontFamily).startsWith('Playfair');
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        base,
        color ? { color } : null,
        align ? { textAlign: align } : null,
        weight && !isSerif ? { fontFamily: weightFamily[weight] } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

export const textColors = {
  muted: colors.inkMuted,
  secondary: colors.inkSecondary,
  ink: colors.ink,
  green: colors.green900,
  coral: colors.coral600,
  white: colors.white,
};

export const styles = StyleSheet.create({});

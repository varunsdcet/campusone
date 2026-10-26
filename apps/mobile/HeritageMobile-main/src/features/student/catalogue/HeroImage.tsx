import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { colors } from '../../../theme';

/** Illustrative hero (no photo asset was supplied – vector placeholder in brand colours). */
export function HeroImage({ kind, height = 160 }: { kind: 'office' | 'trades' | 'pharmacy'; height?: number }) {
  const accent = kind === 'office' ? colors.gold500 : kind === 'trades' ? colors.coral500 : colors.teal600;
  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel={`${kind} illustration`}>
      <Svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice">
        <Rect width="400" height="160" fill={colors.green800} />
        <Circle cx="330" cy="40" r="70" fill={colors.green700} />
        <Circle cx="60" cy="150" r="60" fill={colors.green700} />
        <Rect x="60" y="60" width="130" height="70" rx="10" fill={colors.green100} opacity="0.9" />
        <Rect x="76" y="76" width="98" height="8" rx="4" fill={colors.green700} />
        <Rect x="76" y="92" width="70" height="8" rx="4" fill={colors.green700} />
        <Rect x="76" y="108" width="84" height="8" rx="4" fill={accent} />
        <Path d="M230 120 L270 60 L310 120 Z" fill={accent} />
        <Circle cx="270" cy="110" r="12" fill={colors.cream} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { borderRadius: 20, overflow: 'hidden', marginTop: 4 } });

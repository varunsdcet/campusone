import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../../components';
import { colors, spacing } from '../../theme';

const logoSource = require('../../assets/brand/campusone.png');

export function Logo({ size = 72 }: { size?: number }) {
  return (
    <Image source={logoSource} accessibilityLabel="Campus One logo" resizeMode="contain" style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: colors.white }} />
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.wordmark, compact ? styles.compact : null]}>
      <Logo size={compact ? 40 : 72} />
      <Text variant={compact ? 'displayXs' : 'displayMd'} style={{ lineHeight: compact ? 26 : 36 }}>Campus One</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  compact: { gap: spacing.sm },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { Text } from './Text';
import { colors, radius } from '../theme';

export function IconTile({ icon, label, bg = colors.green50, color = colors.green900, size = 44, round }: { icon?: IconName; label?: string; bg?: string; color?: string; size?: number; round?: boolean }) {
  return (
    <View style={[styles.tile, { backgroundColor: bg, width: size, height: size, borderRadius: round ? size / 2 : radius.md }]}>
      {icon ? <Icon name={icon} color={color} size={Math.round(size * 0.48)} /> : <Text variant="label" color={color}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({ tile: { alignItems: 'center', justifyContent: 'center' } });

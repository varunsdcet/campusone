import React from 'react';
import * as Lucide from 'lucide-react-native';
import { colors } from '../theme';

export type IconName = keyof typeof Lucide;

/** Consistent icon set (Lucide, ISC licence). */
export function Icon({ name, size = 20, color = colors.green900, strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const Cmp = Lucide[name] as unknown as React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  if (!Cmp) return null;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}

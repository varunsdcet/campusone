import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components';
import { colors, spacing } from '../../theme';
import { Logo } from './Brand';

const LOGO_SIZE = 160;

/** Branded splash shown while the session is restored; matches the native launch screen. */
export function SplashScreen() {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1400, useNativeDriver: false }).start();
  }, [progress]);
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['8%', '100%'] });
  return (
    <View style={styles.root} testID="splash-screen">
      <View style={styles.center}>
        <Logo size={LOGO_SIZE} />
        <View style={styles.name}>
          <Text variant="displayMd" color={colors.green900} align="center">Campus One</Text>
          <Text variant="body" color={colors.inkSecondary} align="center" style={styles.tagline} testID="splash-tagline">Learn, teach and manage campus life in one place</Text>
        </View>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.track}><Animated.View style={[styles.bar, { width }]} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  center: { ...StyleSheet.absoluteFill as object, alignItems: 'center', justifyContent: 'center' },
  name: { position: 'absolute', top: '50%', left: spacing.xxxl, right: spacing.xxxl, marginTop: LOGO_SIZE / 2 + spacing.lg, alignItems: 'center' },
  tagline: { marginTop: spacing.xs },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xxxl },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.green700 },
});

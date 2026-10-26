import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, ViewStyle, StyleProp, RefreshControl } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export interface ScreenProps {
  children: React.ReactNode;
  /** Scrollable content (default). */
  scroll?: boolean;
  padded?: boolean;
  background?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
  /** Add bottom inset when there is no tab bar / footer. */
  bottomInset?: boolean;
  keyboard?: boolean;
  onScrollEnd?: () => void;
  scrollRef?: React.Ref<ScrollViewInstance>;
}

export function Screen({ children, scroll = true, padded = true, background = colors.cream, header, footer, contentStyle, refreshing, onRefresh, testID, bottomInset = true, keyboard = true, onScrollEnd, scrollRef }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.green900} /> : undefined}
      contentContainerStyle={[padded ? styles.padded : null, { paddingBottom: (footer ? spacing.lg : bottomInset ? insets.bottom + spacing.xl : spacing.xl) }, contentStyle]}
      onScroll={onScrollEnd ? e => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) onScrollEnd();
      } : undefined}
      scrollEventThrottle={onScrollEnd ? 200 : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View testID={testID} style={[styles.fill, padded ? styles.padded : null, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: background }]}>
      {header}
      {keyboard ? (
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          {body}
          {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{footer}</View> : null}
        </KeyboardAvoidingView>
      ) : (
        <>
          {body}
          {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{footer}</View> : null}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
});

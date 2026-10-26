import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { Icon } from './Icon';
import { colors, radius, spacing, shadows } from '../theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  overline?: string;
  children: React.ReactNode;
  /** Prevent closing via backdrop (e.g. while submitting). */
  locked?: boolean;
  scroll?: boolean;
  testID?: string;
  maxHeightRatio?: number;
}

export function BottomSheet({ visible, onClose, title, subtitle, overline, children, locked, scroll = true, testID, maxHeightRatio = 0.88 }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (visible) Animated.spring(slide, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    else slide.setValue(0);
  }, [visible, slide]);
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });
  const Body = scroll ? ScrollView : View;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={locked ? undefined : onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close sheet" accessibilityRole="button" style={styles.backdrop} onPress={locked ? undefined : onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
          <Animated.View testID={testID} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg), maxHeight: Math.max(240, (height - keyboardHeight) * maxHeightRatio), transform: [{ translateY }] }]}>
            <View style={styles.grabber} />
            {title || overline ? (
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  {overline ? <Text variant="overline">{overline}</Text> : null}
                  {title ? <Text variant="displaySm">{title}</Text> : null}
                  {subtitle ? <Text variant="bodySm">{subtitle}</Text> : null}
                </View>
                {!locked ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12} style={styles.close} testID={testID ? `${testID}-close` : undefined}>
                    <Icon name="X" size={20} color={colors.inkSecondary} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Body style={styles.body} contentContainerStyle={scroll ? styles.bodyContent : undefined} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              {children}
            </Body>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill as object, backgroundColor: colors.overlay },
  kav: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, ...shadows.sheet },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: spacing.md, gap: spacing.md },
});

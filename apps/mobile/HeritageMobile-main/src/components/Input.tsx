import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { colors, radius, spacing, fonts } from '../theme';

export interface InputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  helper?: string;
  error?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  secure?: boolean;
  rightLabel?: string;
  prefix?: string;
  counter?: number;
  containerStyle?: object;
}

export function Input({ label, required, helper, error, leftIcon, rightIcon, onRightIconPress, secure, rightLabel, prefix, counter, containerStyle, style, testID, ...rest }: InputProps) {
  const [hidden, setHidden] = useState(!!secure);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="label">
            {label}
            {required ? <Text variant="label" color={colors.coral600}> *</Text> : null}
          </Text>
          {rightLabel ? <Text variant="caption">{rightLabel}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.field, focused ? styles.focused : null, error ? styles.error : null, rest.multiline ? styles.multiline : null]}>
        {leftIcon ? <Icon name={leftIcon} size={18} color={colors.inkMuted} /> : null}
        {prefix ? <Text variant="body" color={colors.inkSecondary}>{prefix}</Text> : null}
        <TextInput
          testID={testID}
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={colors.inkFaint}
          returnKeyType={rest.multiline ? undefined : 'done'}
          {...rest}
          secureTextEntry={secure ? hidden : rest.secureTextEntry}
          onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={e => { setFocused(false); rest.onBlur?.(e); }}
          style={[styles.input, rest.multiline ? styles.inputMultiline : null, style]}
        />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} onPress={() => setHidden(h => !h)} hitSlop={10} testID={testID ? `${testID}-toggle` : undefined}>
            <Icon name={hidden ? 'Eye' : 'EyeOff'} size={18} color={colors.inkMuted} />
          </Pressable>
        ) : rightIcon ? (
          <Pressable accessibilityRole={onRightIconPress ? 'button' : undefined} onPress={onRightIconPress} hitSlop={10} disabled={!onRightIconPress}>
            <Icon name={rightIcon} size={18} color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text variant="caption" color={colors.danger600} accessibilityLiveRegion="polite">{error}</Text> : helper ? <Text variant="caption">{helper}</Text> : null}
      {counter !== undefined && rest.maxLength ? <Text variant="caption" align="right">{counter} / {rest.maxLength}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, minHeight: 48 },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  focused: { borderColor: colors.green700 },
  error: { borderColor: colors.danger600 },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 10 },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
});

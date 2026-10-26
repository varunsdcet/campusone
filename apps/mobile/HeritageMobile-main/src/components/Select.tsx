import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { BottomSheet } from './BottomSheet';
import { colors, radius, spacing } from '../theme';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface SelectProps<T extends string> {
  label?: string;
  required?: boolean;
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  leftIcon?: IconName;
  helper?: string;
  error?: string;
  compact?: boolean;
  testID?: string;
  sheetTitle?: string;
}

export function Select<T extends string>({ label, required, value, options, onChange, placeholder = 'Select…', leftIcon, helper, error, compact, testID, sheetTitle }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant={compact ? 'overline' : 'label'}>
          {label}
          {required ? <Text variant="label" color={colors.coral600}> *</Text> : null}
        </Text>
      ) : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? placeholder}: ${selected?.label ?? 'none selected'}`}
        onPress={() => setOpen(true)}
        style={[styles.field, compact ? styles.compact : null, error ? styles.error : null]}
      >
        {leftIcon ? <View style={styles.iconBox}><Icon name={leftIcon} size={18} color={colors.green900} /></View> : null}
        <Text variant="body" color={selected ? colors.ink : colors.inkFaint} numberOfLines={1} style={{ flex: 1 }}>{selected?.label ?? placeholder}</Text>
        <Icon name="ChevronDown" size={18} color={colors.inkSecondary} />
      </Pressable>
      {error ? <Text variant="caption" color={colors.danger600}>{error}</Text> : helper ? <Text variant="caption">{helper}</Text> : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={sheetTitle ?? label ?? 'Select'} testID={testID ? `${testID}-sheet` : undefined}>
        {options.map(o => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              testID={testID ? `${testID}-option-${o.value}` : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: o.disabled }}
              disabled={o.disabled}
              onPress={() => { onChange(o.value); setOpen(false); }}
              style={[styles.option, active ? styles.optionActive : null, o.disabled ? styles.optionDisabled : null]}
            >
              <View style={[styles.radio, active ? styles.radioActive : null]}>{active ? <View style={styles.radioDot} /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" color={o.disabled ? colors.inkMuted : colors.ink}>{o.label}</Text>
                {o.description ? <Text variant="caption">{o.description}</Text> : null}
                {o.disabled && o.disabledReason ? <Text variant="caption" color={colors.coral600}>{o.disabledReason}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, minHeight: 48 },
  compact: { minHeight: 40, backgroundColor: colors.surfaceSubtle },
  error: { borderColor: colors.danger600 },
  iconBox: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minHeight: 48 },
  optionActive: { borderColor: colors.green900, backgroundColor: colors.green50 },
  optionDisabled: { opacity: 0.6 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.green900 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green900 },
});
